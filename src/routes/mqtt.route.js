import logger from '../utils/logger.js';
import { HeartbeatHandler } from '../handlers/mqtt/heartbeatHandler.js';
import { DeviceCheckHandler } from '../handlers/mqtt/deviceCheckHandler.js';
import { SensorDataHandler } from '../handlers/mqtt/sensorDataHandler.js';

export class MqttMessageRouter {
  constructor(deviceMonitoring, notificationEmitter) {
    this.deviceMonitoring = deviceMonitoring;
    this.notificationEmitter = notificationEmitter;
    
    // Initialize handlers
    this.heartbeatHandler = new HeartbeatHandler(deviceMonitoring, notificationEmitter);
    this.deviceCheckHandler = new DeviceCheckHandler(notificationEmitter);
    this.sensorDataHandler = new SensorDataHandler(deviceMonitoring, notificationEmitter);
  }

  async routeMessage(topic, message) {
    const timestamp = new Date();
    const msg = message.toString();

    try {
      const topicParts = topic.split('/');
      let deviceCode = null;

      // Extract device code from topic if exists
      if (topicParts.length >= 3 && topicParts[0] === 'binatra-device') {
        deviceCode = topicParts[1];
      }

      // Route to appropriate handler based on topic pattern
      const routeResult = await this.determineRoute(topic, msg, deviceCode);
      
      if (routeResult.handled) {
        logger.info(`MQTT message routed successfully`, {
          topic,
          handler: routeResult.handler,
          deviceCode,
          timestamp: timestamp.toISOString()
        });
        return routeResult.result;
      } else {
        logger.warn(`Unhandled MQTT topic: ${topic}`, { message: msg });
        return { success: false, reason: 'Unhandled topic', topic };
      }

    } catch (error) {
      logger.error(`Error routing MQTT message from topic ${topic}:`, {
        error: error.message,
        topic,
        message: msg,
        timestamp: timestamp.toISOString()
      });

      // Emit error to clients
      this.notificationEmitter.emitToAll('sensor-data-error', {
        topic,
        message: msg,
        error: error.message,
        timestamp: timestamp.toISOString()
      });

      throw error;
    }
  }

  async determineRoute(topic, message, deviceCode) {
    // Handle heartbeat messages: binatra-device/{deviceCode}/heartbeat
    if (topic.includes('/heartbeat')) {
      const result = await this.heartbeatHandler.handleHeartbeat(topic, message, deviceCode);
      return { handled: true, handler: 'HeartbeatHandler', result };
    }

    // Handle device check messages: binatra-device/check/device
    if (topic === 'binatra-device/check/device') {
      const result = await this.deviceCheckHandler.handleDeviceCheck(topic, message);
      return { handled: true, handler: 'DeviceCheckHandler', result };
    }

    // Handle sensor data messages: binatra-device/sensor or binatra-device/{deviceCode}/sensor
    if (topic === 'binatra-device/sensor' || topic.includes('/sensor')) {
      const result = await this.sensorDataHandler.handleSensorData(topic, message, deviceCode);
      return { handled: true, handler: 'SensorDataHandler', result };
    }

    // Topic not handled by any route
    return { handled: false, handler: null, result: null };
  }

  // Helper method to get routing statistics
  getRoutingStats() {
    return {
      supportedTopics: [
        'binatra-device/+/heartbeat',
        'binatra-device/+/sensor', 
        'binatra-device/sensor',
        'binatra-device/check/device'
      ],
      handlers: [
        'HeartbeatHandler',
        'DeviceCheckHandler', 
        'SensorDataHandler'
      ],
      timestamp: new Date().toISOString()
    };
  }
}