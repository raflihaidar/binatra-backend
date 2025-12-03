import logger from '../../utils/logger.js';
import { deviceController } from '../../controllers/device.controller.js';
import { createNotification } from '../../utils/notification.js';

export class DeviceCheckHandler {
  
  constructor(notificationEmitter, mqttClient) {
    this.notificationEmitter = notificationEmitter;
    this.mqttClient = mqttClient;
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
        name : json.deviceName,
        description: json.description || `Auto-created device with code ${checkDeviceCode}`,
        location: json.location || null,
        calibration : json.calibration || 0,
        periode : json.periode || 0
      });

      const isNewDevice = !device;

      // If it's a new device, send notification
      if (isNewDevice) {
        const notification = createNotification('new_device', {
          title: `New Device Registered: ${checkDeviceCode}`,
          deviceCode: checkDeviceCode,
          severity: 'low',
          location: json.location || 0,
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

      const configResponse = JSON.stringify({
        deviceCode: device.code,
        periode : device.periode,
        calibration: device.calibration,
        locationId : device.locationId
      })
    
      this.notificationEmitter.emitToAll('device_status_changed', {
        device: device,
        status : 'CONNECTED'
      });

      this.mqttClient.publish(`binatra-device/${device.code}/settings`, configResponse, {qos : 1} )

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