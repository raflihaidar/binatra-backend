import process from 'process'
import dotenv from 'dotenv'

dotenv.config()

export const mqttConfig = {
  host: process.env.APP_HOST,
  port : process.env.APP_PROTOCOL_PORT,
  protocol : process.env.APP_PROTOCOL,
  topics: {
    waterLevel: 'esp32/sensor/waterlevel',
  }
};