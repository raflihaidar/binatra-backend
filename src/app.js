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
import { DeviceMonitoringService } from './services/deviceMonitoring.service.js'
import { MqttMessageRouter } from './routes/mqtt.route.js'
import { NotificationEmitter } from './services/notificationEmitter.service.js'
import { SocketConnectionManager } from './handlers/socket/socketConnectionManager.js'
import logger from './utils/logger.js'

dotenv.config()

const app = express()
const server = createServer(app)

let sensorData = {
  deviceId: null,
  waterlevel: null,
  rainfall: null,
  timestamp: null,
  lastUpdate: null
}

const io = setupSocket(server, () => sensorData)

// Initialize services
const deviceMonitoring = new DeviceMonitoringService(io)
const notificationEmitter = new NotificationEmitter(io)
const mqttRouter = new MqttMessageRouter(deviceMonitoring, notificationEmitter)
const socketManager = new SocketConnectionManager(io, deviceMonitoring, notificationEmitter)

const port = process.env.APP_PORT
const mqttClient = mqtt.connect(mqttConfig)

// 1. CORS Configuration - HARUS SEBELUM ROUTES
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',  // Vite dev server
      'http://localhost:3000',  // Backend dev
      'http://127.0.0.1:5173',  // Alternative localhost
      'https://binatra.id',     // Production
      'https://www.binatra.id'  // Production with www
    ]
    
    // Allow requests with no origin (Postman, mobile apps)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true,  // CRUCIAL for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 200
}

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

// MQTT Connection Setup
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker')

  // Start device monitoring service
  deviceMonitoring.start()

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

// Simplified MQTT Message Handler using Router
mqttClient.on('message', async (topic, message) => {
  try {
    const result = await mqttRouter.routeMessage(topic, message)
    
    // Update global sensor data if it's sensor data
    if (result.success && result.sensorData) {
      sensorData = result.sensorData
    }

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
  logger.error('MQTT Client Error:', error)
  notificationEmitter.emitSystemNotification('error', 'MQTT Connection Error', { error: error.message })
})

mqttClient.on('close', () => {
  console.log('MQTT connection closed')
  logger.warn('MQTT connection closed')
  
  // Stop device monitoring when MQTT disconnects
  deviceMonitoring.stop()
  notificationEmitter.emitSystemNotification('warning', 'MQTT Connection Closed')
})

mqttClient.on('reconnect', () => {
  console.log('MQTT reconnecting...')
  logger.info('MQTT reconnecting...')
  notificationEmitter.emitSystemNotification('info', 'MQTT Reconnecting...')
})

// Socket.IO Connection Handler using Manager
io.on('connection', (socket) => {
  socketManager.handleConnection(socket)
})

// Health Check Endpoint
app.get('/health', async (req, res) => {
  try {
    const [deviceStatusSummary, floodSummary, notificationStats] = await Promise.all([
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
      },
      data: {
        deviceStatus: deviceStatusSummary,
        floodStatus: floodSummary,
        lastSensorData: sensorData
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

// Additional API endpoints for monitoring
app.get('/api/v1/system/stats', async (req, res) => {
  try {
    const stats = {
      mqtt: {
        connected: mqttClient.connected,
        topics: mqttRouter.getRoutingStats()
      },
      notifications: notificationEmitter.getStats(),
      socket: {
        connectedClients: io.engine.clientsCount,
        activeRooms: notificationEmitter.getActiveRooms()
      },
      deviceMonitoring: await deviceMonitoring.getStatusSummary(),
      timestamp: new Date().toISOString()
    }

    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/v1/system/health-detailed', async (req, res) => {
  try {
    const health = {
      services: {
        express: { status: 'running', port },
        mqtt: { 
          status: mqttClient.connected ? 'connected' : 'disconnected',
          config: mqttConfig.host 
        },
        socketio: { 
          status: 'running',
          clients: io.engine.clientsCount 
        },
        deviceMonitoring: {
          status: deviceMonitoring.intervalId ? 'active' : 'inactive',
          config: {
            heartbeatTimeout: deviceMonitoring.heartbeatTimeout,
            checkInterval: deviceMonitoring.checkInterval
          }
        }
      },
      features: {
        deviceMonitoring: true,
        locationTracking: true,
        floodDetection: true,
        notifications: true,
        mqttRouting: true,
        socketManagement: true
      },
      timestamp: new Date().toISOString()
    }

    res.json(health)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Graceful Shutdown Handler
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`)
  logger.info(`Graceful shutdown initiated by ${signal}`)

  // Stop accepting new requests
  server.close((err) => {
    if (err) {
      logger.error('Error closing server:', err)
      process.exit(1)
    }

    console.log('HTTP server closed')
    logger.info('HTTP server closed')

    // Stop services
    deviceMonitoring.stop()
    console.log('Device monitoring stopped')

    // Close MQTT connection
    mqttClient.end(() => {
      console.log('MQTT connection closed')
      logger.info('MQTT connection closed')
      
      console.log('Graceful shutdown completed')
      logger.info('Graceful shutdown completed')
      process.exit(0)
    })
  })

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down')
    logger.error('Forced shutdown due to timeout')
    process.exit(1)
  }, 10000) // 10 seconds timeout
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
  console.log(startupMessage)
  console.log(`Health check available at: http://localhost:${port}/health`)
  console.log(`System stats available at: http://localhost:${port}/api/v1/system/stats`)
  console.log(`Detailed health check available at: http://localhost:${port}/api/v1/system/health-detailed`)

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
      deviceMonitoring: 'active'
      deviceValidation: true, // ✅ New feature
      securityAlerts: true    // ✅ New feature
    }
  })

  // Send startup notification
  notificationEmitter.emitSystemNotification('info', 'Server Started Successfully', {
    port,
    timestamp: new Date().toISOString()
  })
})