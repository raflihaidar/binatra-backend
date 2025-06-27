import logger from '../../utils/logger.js';
import { deviceController } from '../../controllers/device.controller.js';
import { createNotification } from '../../utils/notification.js';

export class DeviceCheckHandler {
  constructor(notificationEmitter) {
    this.notificationEmitter = notificationEmitter;
  }

  async handleDeviceCheck(topic, message) {
    const timestamp = new Date();
    
    try {
      const json = JSON.parse(message);
      const checkDeviceCode = json.deviceCode;

      if (!checkDeviceCode) {
        const error = 'Device code not provided';
        logger.error('Device check failed: device code not provided in message');
        
        this.notificationEmitter.emitToAll('device-check-error', {
          error,
          timestamp: timestamp.toISOString()
        });
        
        throw new Error(error);
      }

      // Use deviceController.ensureDeviceExists for consistency
      const device = await deviceController.ensureDeviceExists({
        code: checkDeviceCode,
        description: json.description || `Auto-created device with code ${checkDeviceCode}`,
        location: json.location || 'Unknown Location'
      });

      const isNewDevice = !device;

      // If it's a new device, send notification
      if (isNewDevice) {
        const notification = createNotification('new_device', {
          title: `New Device Registered: ${checkDeviceCode}`,
          deviceCode: checkDeviceCode,
          severity: 'low',
          location: json.location || 'Unknown Location',
          timeframe: 'baru terdaftar'
        });

        this.notificationEmitter.emit(notification);
      }

      logger.info('Device check/create completed:', {
        deviceCode: checkDeviceCode,
        deviceId: device.id,
        status: device.status,
        isNewDevice
      });

      // Emit device check result
      this.notificationEmitter.emitToAll('device-check-result', {
        deviceCode: checkDeviceCode,
        device: device,
        isNewDevice,
        timestamp: timestamp.toISOString()
      });

      return {
        success: true,
        device,
        isNewDevice,
        deviceCode: checkDeviceCode
      };

    } catch (error) {
      logger.error('Error during device check/create process:', error);
      
      this.notificationEmitter.emitToAll('device-check-error', {
        error: error.message,
        timestamp: timestamp.toISOString()
      });
      
      throw error;
    }
  }
}