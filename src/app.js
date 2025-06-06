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
import { sensorLogController } from './controllers/sensorLog.controller.js'
import { deviceController } from './controllers/device.controller.js'
import logger from './utils/logger.js'

dotenv.config()

const app = express()
const server = createServer(app)
const io = setupSocket(server, () => sensorData)  

const port = process.env.APP_PORT || 8080
const mqttClient = mqtt.connect(mqttConfig)

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

// REST API fallback route
app.use("/api/v1/auth", auth_routes)
app.use('/api/v1/cuaca', weather_routes)
app.use('/api/v1/devices', device_routes)
app.use('/api/v1/sensorLogs', sensorLog_routes)

// MQTT connection
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker')

  const topics = [
    'binatra-device/sensor',
    'binatra-device/check/device'
  ]

  mqttClient.subscribe(topics, (err) => {
    if (!err) {
      console.log('Subscribed to:', topics.join(', '))
    } else {
      console.error('MQTT subscribe error:', err)
    }
  })
})

// MQTT message handler
mqttClient.on('message', async (topic, message) => {
  const msg = message.toString()
  const timestamp = new Date()

  try {
    console.log(`Received MQTT message from topic: ${topic}`)

    let deviceCode = null
    let tempSensorData = { ...sensorData }

    // Extract device code dari topic jika ada
    const topicParts = topic.split('/')
    if (topicParts.length >= 3 && topicParts[0] === 'binatra-device') {
      deviceCode = topicParts[1] // device code dari topic path
    }

    switch (topic) {
      case 'binatra-device/check/device': {
        // Topic untuk check ketersediaan device dan create jika tidak ada
        try {
          const json = JSON.parse(msg)
          console.log("json : ", json)
          const checkDeviceCode = json.code
          
          if (!checkDeviceCode) {
            logger.error('Device check failed: device code not provided in message')
            io.emit('device-check-error', {
              error: 'Device code not provided',
              timestamp: timestamp.toISOString()
            })
            break
          }

          console.log(`Checking device availability for code: ${checkDeviceCode}`)

          // Check apakah device sudah ada di database
          const mockReqCheck = {
            params: { code: checkDeviceCode }
          }

          const mockResCheck = {
            deviceFound: false,
            deviceData: null,
            status: (code) => ({
              json: (data) => {
                if (code === 200 && data.success) {
                  // Device ditemukan
                  mockResCheck.deviceFound = true
                  mockResCheck.deviceData = data.data
                  
                  logger.info('Device found:', {
                    deviceCode: checkDeviceCode,
                    id: data.data.id,
                    location: data.data.location
                  })
                  
                  // Emit konfirmasi device tersedia
                  io.emit('device-check-result', {
                    deviceCode: checkDeviceCode,
                    exists: true,
                    device: data.data,
                    action: 'found',
                    timestamp: timestamp.toISOString()
                  })
                } else {
                  // Device tidak ditemukan
                  mockResCheck.deviceFound = false
                  
                  logger.info('Device not found, will create new device:', {
                    deviceCode: checkDeviceCode
                  })
                }
              }
            })
          }

          // Check device menggunakan controller
          await deviceController.findDeviceByCode(mockReqCheck, mockResCheck)

          // Jika device tidak ditemukan, create device baru
          if (!mockResCheck.deviceFound) {
            const deviceData = {
              code: checkDeviceCode,
              description: json.description || `Auto-created device with code ${checkDeviceCode}`,
              location: json.location || 'Unknown Location'
            }

            const mockReqCreate = {
              body: deviceData
            }

            const mockResCreate = {
              status: (code) => ({
                json: (data) => {
                  if (code === 201 && data.success) {
                    logger.info('New device created successfully:', {
                      deviceId: data.data.id,
                      deviceCode: data.data.code,
                      location: data.data.location
                    })
                    
                    // Emit konfirmasi device berhasil dibuat
                    io.emit('device-check-result', {
                      deviceCode: checkDeviceCode,
                      exists: false,
                      device: data.data,
                      action: 'created',
                      timestamp: timestamp.toISOString()
                    })
                  } else {
                    logger.error('Failed to create new device:', data)
                    
                    // Emit error jika gagal create
                    io.emit('device-check-error', {
                      deviceCode: checkDeviceCode,
                      error: data.error || 'Failed to create device',
                      timestamp: timestamp.toISOString()
                    })
                  }
                }
              })
            }

            // Create device menggunakan controller
            await deviceController.createDevice(mockReqCreate, mockResCreate)
          }

        } catch (checkError) {
          logger.error('Error during device check/create process:', checkError)
          io.emit('device-check-error', {
            error: checkError.message,
            timestamp: timestamp.toISOString()
          })
        }
        break
      }

      case 'binatra-device/sensor': {
        // Topic untuk single device dengan data gabungan
        const json = JSON.parse(msg)
        
        // Default device code jika tidak ada di topic
        deviceCode = json.deviceCode || json.code
        
        tempSensorData = {
          deviceCode: deviceCode,
          waterlevel: json.waterlevel_cm || json.waterLevel || json.waterlevel || null,
          rainfall: json.rainfall_mm || json.rainfall || json.rain || null,
          timestamp: timestamp,
          lastUpdate: timestamp.toISOString()
        }

        // Langsung save ke database jika ada deviceCode dan data sensor valid
        if (deviceCode && (tempSensorData.rainfall !== null || tempSensorData.waterlevel !== null)) {
          try {
            // Prepare data untuk controller
            const sensorLogData = {
              deviceCode: deviceCode,
              rainfall: tempSensorData.rainfall,
              waterLevel: tempSensorData.waterlevel,
              timestamp: timestamp
            }

            // Create mock request untuk controller
            const mockReq = {
              body: sensorLogData
            }

            // Create mock response untuk controller
            const mockRes = {
              status: (code) => ({
                json: (data) => {
                  if (code === 201) {
                    logger.info('MQTT sensor data saved immediately:', {
                      id: data.data.id,
                      deviceCode: data.data.deviceCode,
                      rainfall: data.data.rainfall,
                      waterLevel: data.data.waterLevel
                    })
                    
                    // Emit konfirmasi save
                    io.emit('sensor-data-saved', {
                      ...tempSensorData,
                      savedToDatabase: true,
                      logId: data.data.id,
                      immediate: true
                    })
                  } else {
                    logger.error('Failed to save MQTT sensor data immediately:', data)
                    io.emit('sensor-data-error', {
                      ...tempSensorData,
                      savedToDatabase: false,
                      error: data.error || 'Save failed',
                      immediate: true
                    })
                  }
                }
              })
            }

            // Langsung save menggunakan controller
            await sensorLogController.createSensorLog(mockReq, mockRes)
            
          } catch (saveError) {
            logger.error('Error saving MQTT data immediately:', saveError)
            io.emit('sensor-data-error', {
              ...tempSensorData,
              savedToDatabase: false,
              error: saveError.message,
              immediate: true
            })
          }
        }
        break
      }

      // Handle topic dengan device code di path: binatra-device/{deviceCode}/sensor
      default: {
        if (topic.startsWith('binatra-device/') && topic.endsWith('/sensor')) {
          const json = JSON.parse(msg)
          
          // Device code dari topic path (binatra-device/{deviceCode}/sensor)
          const extractedDeviceCode = topicParts[1]
          
          tempSensorData = {
            deviceCode: extractedDeviceCode,
            waterlevel: json.waterlevel_cm || json.waterLevel || json.waterlevel || null,
            rainfall: json.rainfall_mm || json.rainfall || json.rain || null,
            timestamp: timestamp,
            lastUpdate: timestamp.toISOString()
          }

          // Langsung save ke database jika ada deviceCode dan data sensor valid
          if (extractedDeviceCode && (tempSensorData.rainfall !== null || tempSensorData.waterlevel !== null)) {
            try {
              // Prepare data untuk controller
              const sensorLogData = {
                deviceCode: extractedDeviceCode,
                rainfall: tempSensorData.rainfall,
                waterLevel: tempSensorData.waterlevel,
                timestamp: timestamp
              }

              // Create mock request untuk controller
              const mockReq = {
                body: sensorLogData
              }

              // Create mock response untuk controller
              const mockRes = {
                status: (code) => ({
                  json: (data) => {
                    if (code === 201) {
                      logger.info('MQTT sensor data saved (device-specific topic):', {
                        id: data.data.id,
                        deviceCode: data.data.deviceCode,
                        rainfall: data.data.rainfall,
                        waterLevel: data.data.waterLevel,
                        topic: topic
                      })
                      
                      // Emit konfirmasi save
                      io.emit('sensor-data-saved', {
                        ...tempSensorData,
                        savedToDatabase: true,
                        logId: data.data.id,
                        immediate: true,
                        topic: topic
                      })
                    } else {
                      logger.error('Failed to save MQTT sensor data (device-specific topic):', data)
                      io.emit('sensor-data-error', {
                        ...tempSensorData,
                        savedToDatabase: false,
                        error: data.error || 'Save failed',
                        immediate: true,
                        topic: topic
                      })
                    }
                  }
                })
              }

              // Langsung save menggunakan controller
              await sensorLogController.createSensorLog(mockReq, mockRes)
              
            } catch (saveError) {
              logger.error('Error saving MQTT data (device-specific topic):', saveError)
              io.emit('sensor-data-error', {
                ...tempSensorData,
                savedToDatabase: false,
                error: saveError.message,
                immediate: true,
                topic: topic
              })
            }
          }
        }
        break
      }
    }

    // Update global sensor data (hanya untuk sensor data, bukan device check)
    if (topic !== 'binatra-device/check/device') {
      sensorData = tempSensorData

      // Emit real-time data to all connected clients (data sudah tersimpan di atas)
      io.emit('sensor-data', sensorData)
      // Emit specific device data
      if (sensorData.deviceCode) {
        io.emit(`sensor-data-${sensorData.deviceCode}`, sensorData)
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
})

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Handle client request untuk data device tertentu
  socket.on('subscribe-device', (deviceId) => {
    socket.join(`device-${deviceId}`)
    console.log(`Client ${socket.id} subscribed to device ${deviceId}`)
  })

  // Handle client unsubscribe dari device
  socket.on('unsubscribe-device', (deviceId) => {
    socket.leave(`device-${deviceId}`)
    console.log(`Client ${socket.id} unsubscribed from device ${deviceId}`)
  })

  // Handle request untuk latest sensor data menggunakan controller
  socket.on('get-latest-data', async (deviceId) => {
    try {
      if (deviceId) {
        // Create mock request/response untuk controller
        const mockReq = {
          params: { deviceId }
        }

        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (code === 200) {
                socket.emit('latest-sensor-data', data.data)
              } else {
                socket.emit('error', { message: 'Failed to get latest data', error: data.error })
              }
            }
          })
        }

        await sensorLogController.getLatestReading(mockReq, mockRes)
      } else {
        socket.emit('latest-sensor-data', sensorData)
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to get latest data', error: error.message })
    }
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mqtt: mqttClient.connected,
    lastSensorData: sensorData,
    timestamp: new Date().toISOString()
  })
})


// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...')
  mqttClient.end()
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

// Jalankan server
server.listen(port, () => {
  console.log(`Binatra Server listening on port ${port}`)
  console.log(`Health check available at: http://localhost:${port}/health`)
})