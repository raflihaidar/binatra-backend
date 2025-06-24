import express from 'express'
import dotenv from 'dotenv'
import mqtt from 'mqtt'
import cors from 'cors'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser';
import { createServer } from 'http'
import { setupSocket } from './config/socket.js'
import { mqttConfig } from './config/mqtt.js'
import { router as auth_routes } from './routes/auth.route.js'
import { router as weather_routes } from './routes/weather.route.js'
import { router as device_routes } from './routes/device.route.js'
import { router as sensorLog_routes } from './routes/sensorLog.route.js'
import { router as location_routes } from './routes/location.route.js'
import { sensorLogController } from './controllers/sensorLog.controller.js'
import { deviceController } from './controllers/device.controller.js'
import { deviceService } from './services/device.service.js'
import { locationController } from './controllers/location.controller.js'
import { locationService } from './services/location.service.js'
import { DeviceMonitoringService } from './services/deviceMonitoring.service.js'
import logger from './utils/logger.js'

dotenv.config()

const app = express()
const server = createServer(app)
const io = setupSocket(server, () => sensorData)

const port = process.env.APP_PORT
const mqttClient = mqtt.connect(mqttConfig)

// Initialize device monitoring service
const deviceMonitoring = new DeviceMonitoringService(io);

let sensorData = {
  deviceId: null,
  waterlevel: null,
  rainfall: null,
  timestamp: null,
  lastUpdate: null
}

// Middleware
app.use(cors())
app.use(express.json())
app.use(cookieParser());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// REST API routes
app.use("/api/v1/auth", auth_routes)
app.use('/api/v1/cuaca', weather_routes)
app.use('/api/v1/devices', device_routes)
app.use('/api/v1/sensorLogs', sensorLog_routes)
app.use('/api/v1/locations', location_routes)

// Helper function untuk create notification
const createNotification = (type, data) => {
  const baseNotification = {
    id: `${type}-${Date.now()}`,
    type: type,
    timestamp: new Date().toISOString(),
    ...data
  };

  return baseNotification;
};

// Helper function untuk emit notification
const emitNotification = (notification) => {
  // Emit ke semua client
  io.emit('new-notification', notification);

  // Emit ke specific subscribers jika ada
  if (notification.deviceCode) {
    io.emit(`notification-device-${notification.deviceCode}`, notification);
  }

  if (notification.locationId) {
    io.emit(`notification-location-${notification.locationId}`, notification);
  }

  logger.info('Notification emitted:', {
    type: notification.type,
    title: notification.title,
    deviceCode: notification.deviceCode,
    locationId: notification.locationId
  });
};

// MQTT connection
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker')

  // Start device monitoring service
  deviceMonitoring.start();

  const topics = [
    'binatra-device/+/heartbeat',  // Device heartbeat: binatra-device/{deviceCode}/heartbeat
    'binatra-device/+/sensor',     // Device sensor data: binatra-device/{deviceCode}/sensor
    'binatra-device/sensor',       // Legacy sensor topic
    'binatra-device/check/device'  // Device check topic
  ]

  mqttClient.subscribe(topics, (err) => {
    if (!err) {
      console.log('Subscribed to:', topics.join(', '))
      logger.info('MQTT topics subscribed successfully', { topics })
    } else {
      console.error('MQTT subscribe error:', err)
      logger.error('MQTT subscribe error:', err)
    }
  })
})

// Enhanced MQTT message handler with Location integration
mqttClient.on('message', async (topic, message) => {
  const msg = message.toString()
  const timestamp = new Date()

  try {
    const topicParts = topic.split('/')
    let deviceCode = null

    // Extract device code from topic if exists
    if (topicParts.length >= 3 && topicParts[0] === 'binatra-device') {
      deviceCode = topicParts[1]
    }

    switch (true) {
      // Handle heartbeat messages: binatra-device/{deviceCode}/heartbeat
      case topic.includes('/heartbeat'): {
        try {
          const json = JSON.parse(msg);
          const heartbeatDeviceCode = deviceCode || json.deviceCode || json.code;

          if (!heartbeatDeviceCode) {
            logger.error('Heartbeat message missing device code', { topic, message: msg });
            break;
          }

          // Get device status before processing heartbeat
          const deviceBefore = await deviceService.findByCode(heartbeatDeviceCode);

          const previousStatus = deviceBefore.status || 'DISCONNECTED';

          // Handle heartbeat through monitoring service
          const device = await deviceMonitoring.handleHeartbeat(heartbeatDeviceCode, {
            description: json.description,
            location: json.location,
            timestamp: json.timestamp
          });

          // Check if device connection status changed
          if (previousStatus !== device.status) {
            const notification = createNotification('device_status_change', {
              title: device.status === 'CONNECTED' ?
                `Device ${heartbeatDeviceCode} Connected` :
                `Device ${heartbeatDeviceCode} Disconnected`,
              deviceCode: heartbeatDeviceCode,
              previousStatus: previousStatus,
              newStatus: device.status,
              severity: device.status === 'CONNECTED' ? 'low' : 'medium',
              location: device.location.name || 'Unknown Location',
              timeframe: 'status berubah',
              data : device
            });

            emitNotification(notification);

            deviceMonitoring.getStatusSummary().then(summary => {
              io.emit('device_status_summary', summary);
            }).catch(error => {
              logger.error('Error getting device status summary for new client:', error);
            });
          }

          logger.info(`Heartbeat processed for device: ${heartbeatDeviceCode}`, {
            deviceCode: heartbeatDeviceCode,
            status: device.status,
            lastSeen: device.lastSeen,
            statusChanged: previousStatus !== device.status
          });

        } catch (heartbeatError) {
          logger.error('Error processing heartbeat:', heartbeatError);
          io.emit('device_heartbeat_error', {
            topic,
            error: heartbeatError.message,
            timestamp: timestamp.toISOString()
          });
        }
        break;
      }

      // Handle device check messages
      case topic === 'binatra-device/check/device': {
        try {
          const json = JSON.parse(msg)
          const checkDeviceCode = json.deviceCode;

          if (!checkDeviceCode) {
            logger.error('Device check failed: device code not provided in message')
            io.emit('device-check-error', {
              error: 'Device code not provided',
              timestamp: timestamp.toISOString()
            })
            break
          }

          // Use deviceController.ensureDeviceExists for consistency
          const device = await deviceController.ensureDeviceExists({
            code: checkDeviceCode,
            description: json.description || `Auto-created device with code ${checkDeviceCode}`,
            location: json.location || 'Unknown Location'
          });

          const isNewDevice = !device;

          // If it's a new device, send notification
          if (isNewDevice) {
            const notification = createNotification('new_device', {
              title: `New Device Registered: ${checkDeviceCode}`,
              deviceCode: checkDeviceCode,
              severity: 'low',
              location: json.location || 'Unknown Location',
              timeframe: 'baru terdaftar'
            });

            emitNotification(notification);
          }

          logger.info('Device check/create completed:', {
            deviceCode: checkDeviceCode,
            deviceId: device.id,
            status: device.status,
            isNewDevice: isNewDevice
          });

          // Emit device check result
          io.emit('device-check-result', {
            deviceCode: checkDeviceCode,
            device: device,
            isNewDevice: isNewDevice,
            timestamp: timestamp.toISOString()
          });

        } catch (checkError) {
          logger.error('Error during device check/create process:', checkError)
          io.emit('device-check-error', {
            error: checkError.message,
            timestamp: timestamp.toISOString()
          })
        }
        break
      }

      // Handle sensor data messages
      // Update bagian sensor data handler di MQTT message handler
      case topic === 'binatra-device/sensor' || topic.includes('/sensor'): {
        const json = JSON.parse(msg)

        // Get device code from topic or message
        const sensorDeviceCode = deviceCode || json.deviceCode || json.code

        if (!sensorDeviceCode) {
          logger.error('Sensor data missing device code', { topic, message: msg });
          break;
        }

        const waterLevel = json.waterlevel_cm || json.waterLevel || json.waterlevel || null;
        const rainfall = json.rainfall_mm || json.rainfall || json.rain || null;

        const tempSensorData = {
          deviceCode: sensorDeviceCode,
          waterlevel: waterLevel,
          rainfall: rainfall,
          timestamp: timestamp,
          lastUpdate: timestamp.toISOString()
        }

        try {
          await deviceMonitoring.handleHeartbeat(sensorDeviceCode);
        } catch (heartbeatError) {
          logger.warn(`Failed to update heartbeat for sensor data from ${sensorDeviceCode}:`, heartbeatError);
        }

        // Save sensor data to SensorLog table
        if (waterLevel !== null || rainfall !== null) {
          try {
            // Prepare data for controller
            const sensorLogData = {
              deviceCode: sensorDeviceCode,
              rainfall: rainfall,
              waterLevel: waterLevel,
              timestamp: timestamp
            }

            // Create mock request for controller
            const mockReq = { body: sensorLogData }
            const mockRes = {
              status: (code) => ({
                json: (data) => {
                  if (code === 201) {
                    logger.info('MQTT sensor data saved:', {
                      id: data.data.id,
                      deviceCode: data.data.deviceCode,
                      rainfall: data.data.rainfall,
                      waterLevel: data.data.waterLevel
                    })

                    // Emit sensor data saved confirmation
                    io.emit('sensor-data-saved', {
                      ...tempSensorData,
                      savedToDatabase: true,
                      logId: data.data.id
                    })
                  } else {
                    logger.error('Failed to save MQTT sensor data:', data)
                    io.emit('sensor-data-error', {
                      ...tempSensorData,
                      savedToDatabase: false,
                      error: data.error || 'Save failed'
                    })
                  }
                }
              })
            }

            // Save using controller
            await sensorLogController.createSensorLog(mockReq, mockRes)

          } catch (saveError) {
            logger.error('Error saving MQTT sensor data:', saveError)
            io.emit('sensor-data-error', {
              ...tempSensorData,
              savedToDatabase: false,
              error: saveError.message
            })
          }
        }

        // Process location status
        if (waterLevel !== null) {
          try {
            const locationResult = await locationController.processSensorData(
              sensorDeviceCode,
              waterLevel,
              rainfall || 0
            );

            // Emit location status change if status changed
            if (locationResult.statusChanged) {
              const statusData = {
                locationId: locationResult.location.id,
                locationName: locationResult.location.name,
                previousStatus: locationResult.previousStatus,
                newStatus: locationResult.newStatus,
                waterLevel: waterLevel,
                rainfall: rainfall,
                timestamp: timestamp.toISOString(),
                duration: locationResult.duration || 0
              };

              // Emit to all clients
              io.emit('location_status_changed', statusData);

              // Emit to specific location subscribers
              io.emit(`location_status_${locationResult.location.id}`, statusData);

              // ✅ TAMBAH: Emit location status history untuk non-AMAN status
              if (['WASPADA', 'SIAGA', 'BAHAYA'].includes(locationResult.newStatus) && locationResult.statusHistory) {
                const historyData = {
                  id: locationResult.statusHistory.id,
                  locationId: locationResult.statusHistory.locationId,
                  location: locationResult.statusHistory.location,
                  previousStatus: locationResult.statusHistory.previousStatus,
                  newStatus: locationResult.statusHistory.newStatus,
                  waterLevel: locationResult.statusHistory.waterLevel,
                  rainfall: locationResult.statusHistory.rainfall,
                  duration: locationResult.statusHistory.duration,
                  changedAt: locationResult.statusHistory.changedAt,
                  timeSinceUpdate: locationResult.statusHistory.timeSinceUpdate,
                  statusColor: locationResult.statusHistory.statusColor,
                  previousStatusColor: locationResult.statusHistory.previousStatusColor,
                  isFloodStatus: locationResult.statusHistory.isFloodStatus,
                  deviceCode: sensorDeviceCode,
                  timestamp: timestamp.toISOString()
                };

                // 📡 EMIT: Location status history created
                io.emit('location_status_history_created', historyData);

                // 📡 EMIT: To specific location history subscribers
                io.emit(`location_history_${locationResult.location.id}`, historyData);

                // 📡 EMIT: To flood status history subscribers (general)
                io.emit('flood_status_history_created', historyData);

                logger.info('Location status history emitted via socket:', {
                  historyId: historyData.id,
                  locationName: historyData.location.name,
                  statusChange: `${historyData.previousStatus} → ${historyData.newStatus}`,
                  waterLevel: historyData.waterLevel,
                  deviceCode: sensorDeviceCode
                });
              }

              // CREATE NOTIFICATION FOR STATUS CHANGE (only for non-AMAN status)
              if (locationResult.newStatus !== 'AMAN') {
                const getSeverity = (status) => {
                  switch (status) {
                    case 'BAHAYA': return 'high';
                    case 'SIAGA': return 'high';
                    case 'WASPADA': return 'medium';
                    default: return 'low';
                  }
                };

                const getStatusTitle = (status, waterLevel) => {
                  switch (status) {
                    case 'BAHAYA': return `Banjir Ketinggian ${waterLevel}cm`;
                    case 'SIAGA': return `Siaga Ketinggian ${waterLevel}cm`;
                    case 'WASPADA': return `Waspada Ketinggian ${waterLevel}cm`;
                    default: return `Status ${status} ${waterLevel}cm`;
                  }
                };

                const notification = createNotification('location_status_change', {
                  title: getStatusTitle(locationResult.newStatus, waterLevel),
                  locationId: locationResult.location.id,
                  locationName: locationResult.location.name,
                  deviceCode: sensorDeviceCode,
                  location: locationResult.location.district || locationResult.location.name,
                  timeframe: locationResult.duration ? `dalam ${locationResult.duration} minutes` : 'status berubah',
                  severity: getSeverity(locationResult.newStatus),
                  previousStatus: locationResult.previousStatus,
                  newStatus: locationResult.newStatus,
                  waterLevel: waterLevel,
                  rainfall: rainfall,
                  // ✅ TAMBAH: Include history ID in notification
                  statusHistoryId: locationResult.statusHistory?.id
                });

                emitNotification(notification);

                // SPECIAL NOTIFICATION FOR NEW FLOOD LOCATIONS
                if (locationResult.previousStatus === 'AMAN' &&
                  ['WASPADA', 'SIAGA', 'BAHAYA'].includes(locationResult.newStatus)) {

                  const floodNotification = createNotification('new_flood_location', {
                    title: `Lokasi Banjir Baru: ${locationResult.location.name}`,
                    locationId: locationResult.location.id,
                    locationName: locationResult.location.name,
                    deviceCode: sensorDeviceCode,
                    location: locationResult.location.district || locationResult.location.name,
                    timeframe: `status ${locationResult.newStatus}`,
                    severity: 'high',
                    newStatus: locationResult.newStatus,
                    waterLevel: waterLevel,
                    rainfall: rainfall,
                    statusHistoryId: locationResult.statusHistory?.id
                  });

                  emitNotification(floodNotification);
                }
              }

              logger.info(`Location status changed: ${locationResult.location.name} from ${locationResult.previousStatus} to ${locationResult.newStatus}`);
            }

            // Emit updated flood warnings list for dashboard cards
            const activeWarnings = await locationService.getActiveFloodWarnings();
            io.emit('flood_warnings_updated', {
              warnings: activeWarnings,
              count: activeWarnings.length,
              timestamp: timestamp.toISOString()
            });

            // Emit flood summary for dashboard counters
            const floodSummary = await locationService.getFloodSummary();
            io.emit('flood_summary_updated', {
              summary: floodSummary,
              timestamp: timestamp.toISOString()
            });

          } catch (locationError) {
            logger.error('Error processing location status:', locationError);
            io.emit('location_processing_error', {
              deviceCode: sensorDeviceCode,
              error: locationError.message,
              timestamp: timestamp.toISOString()
            });
          }
        }

        // Update global sensor data and emit to clients
        sensorData = tempSensorData
        io.emit('sensor-data', sensorData)
        io.emit(`sensor-data-${sensorData.deviceCode}`, sensorData)

        break
      }

      default: {
        logger.warn(`Unhandled MQTT topic: ${topic}`, { message: msg });
        break;
      }
    }

  } catch (err) {
    console.error(`Error parsing MQTT message from topic ${topic}:`, err)
    logger.error('MQTT message parsing error:', {
      topic,
      message: msg,
      error: err.message
    })

    // Emit error to clients
    io.emit('sensor-data-error', {
      topic,
      message: msg,
      error: err.message,
      timestamp: timestamp.toISOString()
    })
  }
})

// MQTT error handler
mqttClient.on('error', (error) => {
  console.error('MQTT Client Error:', error)
  logger.error('MQTT Client Error:', error)
})

// MQTT disconnect handler
mqttClient.on('close', () => {
  console.log('MQTT connection closed')
  logger.warn('MQTT connection closed')

  // Stop device monitoring when MQTT disconnects
  deviceMonitoring.stop();
})

// Enhanced Socket.IO connection with Location features
// Tambahkan di bagian io.on('connection') di app.js

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Send current device status summary to new clients
  deviceMonitoring.getStatusSummary().then(summary => {
    socket.emit('device_status_summary', summary);
  }).catch(error => {
    logger.error('Error getting device status summary for new client:', error);
  });

  // Send current flood summary to new clients
  locationService.getFloodSummary().then(summary => {
    socket.emit('flood_summary', summary);
  }).catch(error => {
    logger.error('Error getting flood summary for new client:', error);
  });

  // Send current active flood warnings to new clients
  locationService.getActiveFloodWarnings().then(warnings => {
    socket.emit('flood_warnings_updated', {
      warnings: warnings,
      count: warnings.length
    });
  }).catch(error => {
    logger.error('Error getting active warnings for new client:', error);
  });

  // ✅ TAMBAH: Send recent location status history to new clients
  locationService.getAllLocationStatusHistory({
    page: 1,
    limit: 20,
    sortBy: 'changedAt',
    sortOrder: 'desc'
  }).then(result => {
    if (result.success) {
      socket.emit('location_status_history_initial', {
        histories: result.data,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      });
    }
  }).catch(error => {
    logger.error('Error getting location status history for new client:', error);
  });

  // Existing device subscriptions
  socket.on('subscribe-device-status', (deviceCode) => {
    socket.join(`device-status-${deviceCode}`)
    console.log(`Client ${socket.id} subscribed to device status ${deviceCode}`)
  })

  socket.on('unsubscribe-device-status', (deviceCode) => {
    socket.leave(`device-status-${deviceCode}`)
    console.log(`Client ${socket.id} unsubscribed from device status ${deviceCode}`)
  })

  // Existing location subscriptions
  socket.on('subscribe-location', (locationId) => {
    socket.join(`location-${locationId}`);
    console.log(`Client ${socket.id} subscribed to location ${locationId}`);
  });

  socket.on('unsubscribe-location', (locationId) => {
    socket.leave(`location-${locationId}`);
    console.log(`Client ${socket.id} unsubscribed from location ${locationId}`);
  });

  // ✅ TAMBAH: Location history subscriptions
  socket.on('subscribe-location-history', (locationId) => {
    socket.join(`location-history-${locationId}`);
    console.log(`Client ${socket.id} subscribed to location history ${locationId}`);
  });

  socket.on('unsubscribe-location-history', (locationId) => {
    socket.leave(`location-history-${locationId}`);
    console.log(`Client ${socket.id} unsubscribed from location history ${locationId}`);
  });

  // ✅ TAMBAH: Flood status history subscriptions (general)
  socket.on('subscribe-flood-history', () => {
    socket.join('flood-history');
    console.log(`Client ${socket.id} subscribed to flood status history`);
  });

  socket.on('unsubscribe-flood-history', () => {
    socket.leave('flood-history');
    console.log(`Client ${socket.id} unsubscribed from flood status history`);
  });

  // Existing notification subscriptions
  socket.on('subscribe-notifications', () => {
    socket.join('notifications');
    console.log(`Client ${socket.id} subscribed to notifications`);
  });

  socket.on('unsubscribe-notifications', () => {
    socket.leave('notifications');
    console.log(`Client ${socket.id} unsubscribed from notifications`);
  });

  socket.on('subscribe-device-notifications', (deviceCode) => {
    socket.join(`notification-device-${deviceCode}`);
    console.log(`Client ${socket.id} subscribed to device notifications for ${deviceCode}`);
  });

  socket.on('subscribe-location-notifications', (locationId) => {
    socket.join(`notification-location-${locationId}`);
    console.log(`Client ${socket.id} subscribed to location notifications for ${locationId}`);
  });

  // ✅ TAMBAH: Handle request for location status history
  socket.on('get-location-history', async (params) => {
    try {
      const { locationId, page = 1, limit = 10 } = params || {};
      
      let result;
      if (locationId) {
        // Get history for specific location
        result = await locationService.getAllLocationStatusHistory({
          locationId,
          page,
          limit,
          sortBy: 'changedAt',
          sortOrder: 'desc'
        });
      } else {
        // Get all location history
        result = await locationService.getAllLocationStatusHistory({
          page,
          limit,
          sortBy: 'changedAt',
          sortOrder: 'desc'
        });
      }

      socket.emit('location-history-response', {
        success: result.success,
        data: result.data,
        pagination: result.pagination,
        locationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('error', { 
        message: 'Failed to get location status history', 
        error: error.message 
      });
    }
  });

  // ✅ TAMBAH: Handle request for flood status history with filters
  socket.on('get-flood-history', async (params) => {
    try {
      const {
        page = 1,
        limit = 20,
        status = null,
        startDate = null,
        endDate = null
      } = params || {};

      const result = await locationService.getAllLocationStatusHistory({
        page,
        limit,
        status,
        startDate,
        endDate,
        sortBy: 'changedAt',
        sortOrder: 'desc'
      });

      socket.emit('flood-history-response', {
        success: result.success,
        data: result.data,
        pagination: result.pagination,
        filters: { status, startDate, endDate },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('error', { 
        message: 'Failed to get flood status history', 
        error: error.message 
      });
    }
  });

  // Existing handlers
  socket.on('get-location-details', async (locationId) => {
    try {
      const location = await locationService.getLocationById(locationId);
      socket.emit('location-details', location);
    } catch (error) {
      socket.emit('error', { 
        message: 'Failed to get location details', 
        error: error.message 
      });
    }
  });

  socket.on('get-flood-status', async () => {
    try {
      const [summary, warnings] = await Promise.all([
        locationService.getFloodSummary(),
        locationService.getActiveFloodWarnings()
      ]);
      
      socket.emit('flood-status-response', {
        summary,
        warnings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('error', { 
        message: 'Failed to get flood status', 
        error: error.message 
      });
    }
  });

  // Existing device subscriptions
  socket.on('subscribe-device', (deviceId) => {
    socket.join(`device-${deviceId}`)
    console.log(`Client ${socket.id} subscribed to device ${deviceId}`)
  })

  socket.on('unsubscribe-device', (deviceId) => {
    socket.leave(`device-${deviceId}`)
    console.log(`Client ${socket.id} unsubscribed from device ${deviceId}`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})


app.get('/health', async (req, res) => {
  try {
    const [deviceStatusSummary, floodSummary] = await Promise.all([
      deviceMonitoring.getStatusSummary(),
      locationService.getFloodSummary()
    ]);

    res.json({
      status: 'healthy',
      mqtt: mqttClient.connected,
      deviceMonitoring: {
        active: deviceMonitoring.intervalId !== null,
        heartbeatTimeout: deviceMonitoring.heartbeatTimeout,
        checkInterval: deviceMonitoring.checkInterval
      },
      deviceStatus: deviceStatusSummary,
      floodStatus: floodSummary,
      lastSensorData: sensorData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...')

  // Stop device monitoring
  deviceMonitoring.stop();

  // Close MQTT connection
  mqttClient.end()

  // Close server
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// Start server
server.listen(port, () => {
  console.log(`Binatra Server listening on port ${port}`)
  console.log(`Health check available at: http://localhost:${port}/health`)
  logger.info('Server started successfully', {
    port,
    mqttConfig: mqttConfig.host,
    deviceMonitoring: {
      heartbeatTimeout: deviceMonitoring.heartbeatTimeout,
      checkInterval: deviceMonitoring.checkInterval
    },
    features: {
      deviceMonitoring: true,
      locationTracking: true,
      floodDetection: true,
      notifications: true
    }
  })
})