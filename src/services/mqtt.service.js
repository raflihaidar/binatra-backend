import mqtt from 'mqtt';
import { mqttConfig } from '../config/mqtt.js';
import { sensorLogService } from './sensorLog.service.js';
import { deviceStatusService } from './deviceStatus.service.js';
import { alertService } from './alert.service.js';
import { SensorType } from '../models/enums/SensorType.js';
import { DeviceStatusType } from '../models/enums/DeviceStatusType.js';
import logger from '../utils/logger.js';

class MqttService {
  constructor() {
    this.client = null;
  }

  connect() {
    this.client = mqtt.connect(mqttConfig.broker, {
      clientId: mqttConfig.clientId,
      username: mqttConfig.username,
      password: mqttConfig.password,
      clean: true
    });

    this.client.on('connect', () => {
      logger.info('Connected to MQTT broker');
      
      // Subscribe to topics
      this.client.subscribe(mqttConfig.topics.sensorData);
      this.client.subscribe(mqttConfig.topics.deviceStatus);
      
      logger.info(`Subscribed to topics: ${mqttConfig.topics.sensorData}, ${mqttConfig.topics.deviceStatus}`);
    });

    this.client.on('message', this.handleMessage.bind(this));
    
    this.client.on('error', (error) => {
      logger.error('MQTT Error:', error);
    });
  }

  async handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      logger.info(`Received message on ${topic}: ${messageStr}`);

      // Parse device ID from topic
      // Expected format: devices/{deviceId}/sensors/{sensorType} or devices/{deviceId}/status
      const topicParts = topic.split('/');
      const deviceId = topicParts[1];
      
      if (topic.includes('/sensors/')) {
        await this.handleSensorData(deviceId, topicParts[3], messageStr);
      } else if (topic.includes('/status')) {
        await this.handleDeviceStatus(deviceId, messageStr);
      }
    } catch (error) {
      logger.error('Error handling MQTT message:', error);
    }
  }

  async handleSensorData(deviceId, sensorTypeStr, messageStr) {
    try {
      const data = JSON.parse(messageStr);
      const sensorType = sensorTypeStr;
      
      // Create sensor log
      await sensorLogService.createSensorLog({
        deviceId,
        sensorType,
        value: data.value,
        unit: data.unit || '',
        timestamp: new Date(data.timestamp || Date.now())
      });

      // Check if there are any alert thresholds for this device and sensor
      await alertService.checkAlertThresholds(deviceId, sensorType, data.value);
      
    } catch (error) {
      logger.error(`Error handling sensor data for device ${deviceId}:`, error);
    }
  }

  async handleDeviceStatus(deviceId, messageStr) {
    try {
      const data = JSON.parse(messageStr);
      
      await deviceStatusService.updateDeviceStatus({
        deviceId,
        status: data.status,
        lastSeen: new Date(data.timestamp || Date.now())
      });
      
    } catch (error) {
      logger.error(`Error handling device status for device ${deviceId}:`, error);
    }
  }

  publish(topic, message) {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }
    
    const messageString = typeof message === 'object' 
      ? JSON.stringify(message) 
      : message;
      
    this.client.publish(topic, messageString);
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
    }
  }
}

export const mqttService = new MqttService();