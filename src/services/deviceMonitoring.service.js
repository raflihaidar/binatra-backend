import { deviceService } from '../services/device.service.js';
import logger from '../utils/logger.js';

class DeviceMonitoringService {
  constructor(io) {
    this.io = io;
    this.heartbeatTimeout = 5; // minutes
    this.checkInterval = 2; // minutes
    this.intervalId = null;
  }

  /**
   * Start the device monitoring service
   */
  start() {
    logger.info('Starting device monitoring service...');
    
    // Check for offline devices every 2 minutes
    this.intervalId = setInterval(() => {
      this.checkOfflineDevices();
    }, this.checkInterval * 60 * 1000);

    logger.info(`Device monitoring started with ${this.heartbeatTimeout}min timeout, checking every ${this.checkInterval}min`);
  }

  /**
   * Stop the device monitoring service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Device monitoring service stopped');
    }
  }

  /**
   * Handle device heartbeat from MQTT
   * @param {string} deviceCode - Device code
   * @param {Object} heartbeatData - Heartbeat data from device
   */
  async handleHeartbeat(deviceCode, heartbeatData = {}) {
    try {
      // Ensure device exists (auto-create if needed)
      await deviceService.ensureDeviceExists({
        code: deviceCode,
        description: heartbeatData.description,
        location: heartbeatData.location
      });

      // Update heartbeat
      const device = await deviceService.updateHeartbeat(deviceCode, new Date());
      
      logger.debug(`Heartbeat received from device: ${deviceCode}`);
      
      // Emit device status change via Socket.IO
      this.emitDeviceStatusChange(device, 'heartbeat');
      
      return device;
    } catch (error) {
      logger.error(`Error handling heartbeat for device ${deviceCode}:`, error);
      throw error;
    }
  }

  /**
   * Check for offline devices and update their status
   */
  async checkOfflineDevices() {
    try {
      const offlineDevices = await deviceService.checkAndUpdateOfflineDevices(this.heartbeatTimeout);
      
      if (offlineDevices.length > 0) {
        logger.info(`Found ${offlineDevices.length} devices that went offline`);
        
        // Emit status changes for each offline device
        for (const device of offlineDevices) {
          this.emitDeviceStatusChange({
            ...device,
            status: 'DISCONNECTED'
          }, 'timeout');
        }
      }
    } catch (error) {
      logger.error('Error checking offline devices:', error);
    }
  }

  /**
   * Emit device status change via Socket.IO
   * @param {Object} device - Device object
   * @param {string} reason - Reason for status change
   */
  emitDeviceStatusChange(device, reason = 'unknown') {
    const statusData = {
      deviceCode: device.code,
      status: device.status,
      lastSeen: device.lastSeen,
      timestamp: new Date().toISOString(),
      reason
    };

    // Emit to all clients
    this.io.emit('device_status_changed', statusData);
    
    // Emit to specific device subscribers
    this.io.emit(`device_status_${device.code}`, statusData);
    
    logger.debug(`Emitted status change for device ${device.code}: ${device.status} (${reason})`);
  }

  /**
   * Get real-time device status summary
   */
  async getStatusSummary() {
    try {
      return await deviceService.getStatusSummary();
    } catch (error) {
      logger.error('Error getting status summary:', error);
      throw error;
    }
  }

  /**
   * Force device status update (manual override)
   * @param {string} deviceCode - Device code
   * @param {string} status - New status
   * @param {string} reason - Reason for manual change
   */
  async forceStatusUpdate(deviceCode, status, reason = 'manual') {
    try {
      const device = await deviceService.updateStatus(deviceCode, status);
      this.emitDeviceStatusChange(device, reason);
      return device;
    } catch (error) {
      logger.error(`Error forcing status update for device ${deviceCode}:`, error);
      throw error;
    }
  }

  /**
   * Set heartbeat timeout (in minutes)
   * @param {number} minutes - Timeout in minutes
   */
  setHeartbeatTimeout(minutes) {
    this.heartbeatTimeout = minutes;
    logger.info(`Heartbeat timeout updated to ${minutes} minutes`);
  }

  /**
   * Set check interval (in minutes)
   * @param {number} minutes - Check interval in minutes
   */
  setCheckInterval(minutes) {
    this.checkInterval = minutes;
    
    // Restart the interval with new timing
    if (this.intervalId) {
      this.stop();
      this.start();
    }
    
    logger.info(`Check interval updated to ${minutes} minutes`);
  }
}

export { DeviceMonitoringService };