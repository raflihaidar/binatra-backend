import process from 'process'
import dotenv from 'dotenv'

dotenv.config()

const isProduction = process.env.NODE_ENV === 'production'

export const mqttConfig = {
  host: process.env.APP_HOST,
  port: Number(process.env.APP_PROTOCOL_PORT),
  protocol: process.env.APP_PROTOCOL,
  ...(isProduction && {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
  }),
  topics: {
    waterLevel: 'esp32/sensor/waterlevel',
  }
}
