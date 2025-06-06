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
  console.log('Connected to MQTT Binatra')

  const topics = [
    'binatra-device/sensor',
    'binatra-device/+/sensor',  // Support untuk multiple devices
    'binatra-device/+/rainfall',
    'binatra-device/+/waterlevel',
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
    console.log(`Message: ${msg}`)

    let deviceId = null
    let tempSensorData = { ...sensorData }

    // Extract device ID dari topic jika ada
    const topicParts = topic.split('/')
    if (topicParts.length >= 3 && topicParts[0] === 'binatra-device') {
      deviceId = topicParts[1] // device ID dari topic path
    }

    switch (topic) {
      case 'binatra-device/sensor': {
        // Topic untuk single device dengan data gabungan
        const json = JSON.parse(msg)
        
        // Default device ID jika tidak ada di topic
        deviceId = json.deviceId
        
        tempSensorData = {
          deviceId: deviceId,
          waterlevel: json.waterlevel_cm || json.waterLevel || json.waterlevel || null,
          rainfall: json.rainfall_mm || json.rainfall || json.rain || null,
          timestamp: timestamp,
          lastUpdate: timestamp.toISOString()
        }
        break
      }
      
      default: {
        // Handle dynamic topics dengan device ID
        if (topic.includes('/sensor')) {
          const json = JSON.parse(msg)
          
          tempSensorData = {
            deviceId: deviceId || json.deviceId || 'unknown-device',
            waterlevel: json.waterlevel_cm || json.waterLevel || json.waterlevel || tempSensorData.waterlevel,
            rainfall: json.rainfall_mm || json.rainfall || json.rain || tempSensorData.rainfall,
            timestamp: timestamp,
            lastUpdate: timestamp.toISOString()
          }
        } 
        // else if (topic.includes('/rainfall')) {
        //   const rainfallValue = parseFloat(msg) || null
        //   tempSensorData = {
        //     ...tempSensorData,
        //     deviceId: deviceId || tempSensorData.deviceId || 'unknown-device',
        //     rainfall: rainfallValue,
        //     timestamp: timestamp,
        //     lastUpdate: timestamp.toISOString()
        //   }
        // } else if (topic.includes('/waterlevel')) {
        //   const waterlevelValue = parseFloat(msg) || null
        //   tempSensorData = {
        //     ...tempSensorData,
        //     deviceId: deviceId || tempSensorData.deviceId || 'unknown-device',
        //     waterlevel: waterlevelValue,
        //     timestamp: timestamp,
        //     lastUpdate: timestamp.toISOString()
        //   }
        // }
        break
      }
    }

    // Update global sensor data
    sensorData = tempSensorData

    // Log received data
    console.log('Processed sensor data:', sensorData)

    // Simpan ke database menggunakan controller (async, tidak menunggu response)
    if (sensorData.deviceId && sensorData.deviceId !== 'unknown-device') {
      saveSensorDataViaController(sensorData.deviceId, sensorData)
        .then(savedLog => {
          if (savedLog) {
            // Emit data dengan informasi database save
            io.emit('sensor-data-saved', {
              ...sensorData,
              savedToDatabase: true,
              logId: savedLog.id
            })
          }
        })
        .catch(error => {
          logger.error('Failed to save sensor data via controller:', error)
          io.emit('sensor-data-error', {
            ...sensorData,
            savedToDatabase: false,
            error: error.message
          })
        })
    }

    // Emit real-time data to all connected clients
    io.emit('sensor-data', sensorData)
    console.log('Sent to clients via Socket.IO:', sensorData)

    // Emit specific device data
    if (sensorData.deviceId) {
      io.emit(`sensor-data-${sensorData.deviceId}`, sensorData)
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

  // Kirim data awal saat klien pertama kali terhubung
  socket.emit('sensor-data', sensorData)

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