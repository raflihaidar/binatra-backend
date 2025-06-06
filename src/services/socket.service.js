import logger from '../utils/logger.js';

class SocketService {
  constructor() {
    this.io = null;
  }

  // Initialize with io instance
  initialize(io) {
    this.io = io;
    logger.info('Socket.IO service initialized');
  }

  // Check if initialized
  checkInitialized() {
    if (!this.io) {
      throw new Error('Socket.IO service not initialized');
    }
  }

  // Broadcast sensor data for a specific device
  broadcastSensorData(deviceId, sensorType, data) {
    this.checkInitialized();
    this.io.to(`device: ${deviceId}`).emit('sensor-data', {
      deviceId,
      sensorType,
      data,
      timestamp: new Date()
    });
  }

  // Broadcast device status update
  broadcastDeviceStatus(deviceId, status, lastSeen = new Date()) {
    this.checkInitialized();
    this.io.to(`device:${deviceId}`).emit('device-status', {
      deviceId,
      status,
      lastSeen
    });
  }

  // Broadcast alerts
  broadcastAlert(alert) {
    this.checkInitialized();
    this.io.to(`device:${alert.deviceId}`).emit('alert', {
      ...alert,
      timestamp: new Date()
    });
  }

  // Send to specific client
  sendToClient(socketId, event, data) {
    this.checkInitialized();
    this.io.to(socketId).emit(event, data);
  }

  // Broadcast to all connected clients
  broadcastToAll(event, data) {
    this.checkInitialized();
    this.io.emit(event, data);
  }
}

// Export singleton instance
const socketService = new SocketService();
export default socketService;