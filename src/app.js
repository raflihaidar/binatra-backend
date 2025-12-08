import express from 'express'
import dotenv from 'dotenv'
import mqtt from 'mqtt'
import cors from 'cors'
import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser';
import { createServer } from 'http'
import { setupSocket } from './config/socket.js'
import { mqttConfig } from './config/mqtt.js'
import { corsOptions } from './config/cors.js'
import { router as auth_routes } from './routes/auth.route.js'
import { router as weather_routes } from './routes/weather.route.js'
import { router as device_routes } from './routes/device.route.js'
import { router as sensorLog_routes } from './routes/sensorLog.route.js'
import { router as location_routes } from './routes/location.route.js'
import {router as prediciton_routes} from './routes/prediction.route.js'
import { DeviceMonitoringService } from './services/deviceMonitoring.service.js'
import { MqttMessageRouter } from './routes/mqtt.route.js'
import { NotificationEmitter } from './services/notificationEmitter.service.js'
import { SocketConnectionManager } from './handlers/socket/socketConnectionManager.js'
import logger from './logger/index.js'
import { setupSocketHandler } from './handlers/socket/index.js'

dotenv.config()

const app = express()
const server = createServer(app)
const mqttClient = mqtt.connect(mqttConfig)
const io = setupSocket(server, () => null)

// Initialize services
const deviceMonitoring = new DeviceMonitoringService(io)
const notificationEmitter = new NotificationEmitter(io)
const mqttRouter = new MqttMessageRouter(deviceMonitoring, notificationEmitter, mqttClient)
const socketManager = new SocketConnectionManager(io, deviceMonitoring, notificationEmitter)
setupSocketHandler(io, socketManager, mqttClient)
const port = process.env.APP_PORT

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// REST API routes
app.use("/api/v1/auth", auth_routes)
app.use('/api/v1/cuaca', weather_routes)
app.use('/api/v1/devices', device_routes)
app.use('/api/v1/sensorLogs', sensorLog_routes)
app.use('/api/v1/locations', location_routes)
app.use('/api/v1/prediction', prediciton_routes)

// MQTT Connection Setup
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker')

  // Start device monitoring service
  deviceMonitoring.start()

  const topics = [
    'binatra-device/+/heartbeat',  // Device heartbeat: binatra-device/{deviceCode}/heartbeat
    'binatra-device/+/sensor',     // Device sensor data: binatra-device/{deviceCode}/sensor
    'binatra-device/+/settings',     // Device sensor data: binatra-device/{deviceCode}/sensor
    'binatra-device/sensor',       // Legacy sensor topic
    'binatra-device/check/device',  // Device check topic
    'binatra-device/settings'  // Device check topic
  ]

  mqttClient.subscribe(topics, (err) => {
    if (!err) {
      logger.info({ topics }, `Subscribed to: ${topics.join(', ')}`)
    } else {
      logger.error({err}, 'MQTT subscribe error')
    }
  })
})

// Simplified MQTT Message Handler using Router
mqttClient.on('message', async (topic, message) => {
  try {
    const result = await mqttRouter.routeMessage(topic, message)

    logger.debug('MQTT message processed successfully', {
      topic,
      handler: result.handler,
      success: result.success
    })
  } catch (error) {
    logger.error('Error processing MQTT message:', {
      topic,
      error: error.message,
      timestamp: new Date().toISOString()
    })

    // Emit error notification
    notificationEmitter.emitErrorNotification('MQTT Handler', error, { topic })
  }
})

// MQTT Error Handlers
mqttClient.on('error', (error) => {
  console.error('MQTT Client Error:', error)
  // logger.error('MQTT Client Error:', error)
  notificationEmitter.emitSystemNotification('error', 'MQTT Connection Error', { error: error.message })
})


mqttClient.on('close', () => {
  console.log('MQTT connection closed')
  // logger.warn('MQTT connection closed')
  
  // Stop device monitoring when MQTT disconnects
  deviceMonitoring.stop()
  notificationEmitter.emitSystemNotification('warning', 'MQTT Connection Closed')
})

mqttClient.on('reconnect', () => {
  console.log('MQTT reconnecting...')
  // logger.info('MQTT reconnecting...')
  notificationEmitter.emitSystemNotification('info', 'MQTT Reconnecting...')
})

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    const [notificationStats] = await Promise.all([
      deviceMonitoring.getStatusSummary(),
      // locationService.getFloodSummary(), // You'll need to import this if still needed
      Promise.resolve({}), // Placeholder for flood summary
      notificationEmitter.getStats()
    ])

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mqtt: {
          connected: mqttClient.connected,
          reconnecting: mqttClient.reconnecting || false
        },
        deviceMonitoring: {
          active: deviceMonitoring.intervalId !== null,
          heartbeatTimeout: deviceMonitoring.heartbeatTimeout,
          checkInterval: deviceMonitoring.checkInterval
        },
        notifications: {
          totalEmitted: notificationStats.totalEmitted,
          errors: notificationStats.errors,
          connectedClients: notificationStats.connectedClients
        },
        socket: {
          connectedClients: io.engine.clientsCount,
          activeRooms: notificationEmitter.getActiveRooms().length
        }
      }
    }

    res.json(healthData)

  } catch (error) {
    logger.error('Health check failed:', error)
    
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
})

// Graceful Shutdown Handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`)
  logger.info(`Graceful shutdown initiated by ${signal}`)

  // Stop accepting new requests
  server.close((err) => {
    if (err) {
      // logger.error('Error closing server:', err)
      process.exit(1)
    }

    console.log('HTTP server closed')
    // logger.info('HTTP server closed')

    // Stop services
    deviceMonitoring.stop()
    // console.log('Device monitoring stopped')

    // Close MQTT connection
    mqttClient.end(() => {
      console.log('MQTT connection closed')
      // logger.info('MQTT connection closed')
      
      console.log('Graceful shutdown completed')
      // logger.info('Graceful shutdown completed')
      process.exit(0)
    })
  })

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down')
    // logger.error('Forced shutdown due to timeout')
    process.exit(1)
  }, 1000) // 10 seconds timeout
}

// Handle different shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')) // Nodemon restart

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  notificationEmitter.emitSystemNotification('critical', 'Uncaught Exception', { error: error.message })
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
  notificationEmitter.emitSystemNotification('critical', 'Unhandled Promise Rejection', { reason })
})

// Start Server
server.listen(port, () => {
  const startupMessage = `Binatra Server listening on port ${port}`
  logger.info(startupMessage)

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
      notifications: true,
      mqttRouting: true,
      socketManagement: true,
      modularArchitecture: true
    },
    modules: {
      mqttRouter: 'active',
      notificationEmitter: 'active', 
      socketManager: 'active',
      deviceMonitoring: 'active',
      deviceValidation: true,
      securityAlerts: true 
    }
  })
})