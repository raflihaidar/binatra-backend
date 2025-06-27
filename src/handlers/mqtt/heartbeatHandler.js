import logger from '../../utils/logger.js';
import { deviceService } from '../../services/device.service.js';
import { createNotification } from '../../utils/notification.js';

export class HeartbeatHandler {
  constructor(deviceMonitoring, notificationEmitter) {
    this.deviceMonitoring = deviceMonitoring;
    this.notificationEmitter = notificationEmitter;
  }

  async handleHeartbeat(topic, message, deviceCode) {
    try {
      const json = JSON.parse(message);
      const heartbeatDeviceCode = deviceCode || json.deviceCode || json.code;

      if (!heartbeatDeviceCode) {
        logger.error('Heartbeat message missing device code', { topic, message });
        throw new Error('Heartbeat message missing device code');
      }

      // Get device status before processing heartbeat
      const deviceBefore = await deviceService.findByCode(heartbeatDeviceCode);
      const previousStatus = deviceBefore?.status || 'DISCONNECTED';

      // Handle heartbeat through monitoring service
      const device = await this.deviceMonitoring.handleHeartbeat(heartbeatDeviceCode, {
        description: json.description,
        location: json.location,
        timestamp: json.timestamp
      });

      // Check if device connection status changed
      const statusChanged = previousStatus !== device.status;
      
      if (statusChanged) {
        const notification = createNotification('device_status_change', {
          title: device.status === 'CONNECTED' 
            ? `Device ${heartbeatDeviceCode} Connected`
            : `Device ${heartbeatDeviceCode} Disconnected`,
          deviceCode: heartbeatDeviceCode,
          previousStatus: previousStatus,
          newStatus: device.status,
          severity: device.status === 'CONNECTED' ? 'low' : 'medium',
          location: device.location?.name || 'Unknown Location',
          timeframe: 'status berubah',
          data: device
        });

        // Emit notification
        this.notificationEmitter.emit(notification);

        // Emit device status summary
        const summary = await this.deviceMonitoring.getStatusSummary();
        this.notificationEmitter.emitToAll('device_status_summary', summary);
      }

      logger.info(`Heartbeat processed for device: ${heartbeatDeviceCode}`, {
        deviceCode: heartbeatDeviceCode,
        status: device.status,
        lastSeen: device.lastSeen,
        statusChanged
      });

      return {
        success: true,
        device,
        statusChanged,
        previousStatus,
        newStatus: device.status
      };

    } catch (error) {
      logger.error('Error processing heartbeat:', error);
      
      // Emit error to clients
      this.notificationEmitter.emitToAll('device_heartbeat_error', {
        topic,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }
}