import { deviceService } from '../services/device.service.js';
import logger from '../utils/logger.js';

class DeviceController {
  /**
   * Get all devices with pagination
   */
  getAllDevices = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const devices = await deviceService.getAllDevice({ skip, take: limit });
      
      return res.status(200).json({
        success: true,
        message: 'Devices retrieved successfully',
        data: {
          page,
          limit,
          devices
        }
      });
    } catch (error) {
      logger.error('Error getting devices:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get devices',
        error: error.message 
      });
    }
  }

  /**
   * Create a new device
   */
  createDevice = async (req, res) => {
    try {
      const { code, locationId, description } = req.body;
  
      if (!code) {
        return res.status(400).json({ 
          success: false,
          message: 'Device code is required' 
        });
      }
  
      const device = await deviceService.createDevice({ 
        code, 
        locationId, 
        description,
     
      });
  
      return res.status(201).json({
        success: true,
        message: 'Device created successfully',
        data: device
      });
    } catch (error) {
      logger.error('Error creating device:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to create device', 
        error: error.message 
      });
    }
  };

  /**
   * Find device by code
   */
  findDeviceByCode = async (req, res) => {
    try {

      const { code } = req.params;
      console.log(" code yang diterima : ", code)
      
      if (!code) {
        return res.status(400).json({ 
          success: false,
          message: 'Device code is required' 
        });
      }
  
      const device = await deviceService.findByCode(code);

      console.log("device yang ditemukan : ", device)
  
      return res.status(200).json({
        success: true,
        message: 'Device found',
        data: device
      });
    } catch (error) {
      logger.error('Error finding device:', error);
      return res.status(404).json({ 
        success: false,
        message: 'Device not found', 
        error: error.message 
      });
    }
  };

  /**
   * Update device heartbeat (MQTT heartbeat endpoint)
   */
  updateHeartbeat = async (req, res) => {
    try {
      const { code } = req.params;
      const { timestamp } = req.body;
      
      if (!code) {
        return res.status(400).json({ 
          success: false,
          message: 'Device code is required' 
        });
      }

      const heartbeatTime = timestamp ? new Date(timestamp) : new Date();
      const device = await deviceService.updateHeartbeat(code, heartbeatTime);
      
      return res.status(200).json({
        success: true,
        message: 'Heartbeat updated successfully',
        data: device
      });
    } catch (error) {
      logger.error('Error updating heartbeat:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to update heartbeat', 
        error: error.message 
      });
    }
  };

  /**
   * Update device status manually
   */
  updateDeviceStatus = async (req, res) => {
    try {
      const { code } = req.params;
      const { status } = req.body;
      
      if (!code) {
        return res.status(400).json({ 
          success: false,
          message: 'Device code is required' 
        });
      }

      if (!status || !['CONNECTED', 'DISCONNECTED'].includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: 'Valid status is required (CONNECTED or DISCONNECTED)' 
        });
      }

      const device = await deviceService.updateStatus(code, status);
      
      return res.status(200).json({
        success: true,
        message: 'Device status updated successfully',
        data: device
      });
    } catch (error) {
      logger.error('Error updating device status:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to update device status', 
        error: error.message 
      });
    }
  };

  /**
   * Get devices by status
   */
  getDevicesByStatus = async (req, res) => {
    try {
      const { status } = req.params;
      
      if (!status || !['CONNECTED', 'DISCONNECTED'].includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: 'Valid status is required (CONNECTED or DISCONNECTED)' 
        });
      }

      const devices = await deviceService.getDevicesByStatus(status);
      
      return res.status(200).json({
        success: true,
        message: `${status} devices retrieved successfully`,
        data: devices
      });
    } catch (error) {
      logger.error('Error getting devices by status:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get devices by status', 
        error: error.message 
      });
    }
  };

  /**
   * Get connected devices
   */
  getConnectedDevices = async (req, res) => {
    try {
      const devices = await deviceService.getConnectedDevices();
      
      return res.status(200).json({
        success: true,
        message: 'Connected devices retrieved successfully',
        data: devices
      });
    } catch (error) {
      logger.error('Error getting connected devices:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get connected devices', 
        error: error.message 
      });
    }
  };

  /**
   * Get disconnected devices
   */
  getDisconnectedDevices = async (req, res) => {
    try {
      const devices = await deviceService.getDisconnectedDevices();
      
      return res.status(200).json({
        success: true,
        message: 'Disconnected devices retrieved successfully',
        data: devices
      });
    } catch (error) {
      logger.error('Error getting disconnected devices:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get disconnected devices', 
        error: error.message 
      });
    }
  };

  /**
   * Get device status summary
   */
  getStatusSummary = async (req, res) => {
    try {
      const summary = await deviceService.getStatusSummary();
      
      return res.status(200).json({
        success: true,
        message: 'Status summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      logger.error('Error getting status summary:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get status summary', 
        error: error.message 
      });
    }
  };

  /**
   * Get recently active devices
   */
  getRecentlyActiveDevices = async (req, res) => {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const limit = parseInt(req.query.limit) || 10;
      
      const devices = await deviceService.getRecentlyActiveDevices(hours, limit);
      
      return res.status(200).json({
        success: true,
        message: 'Recently active devices retrieved successfully',
        data: devices
      });
    } catch (error) {
      logger.error('Error getting recently active devices:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get recently active devices', 
        error: error.message 
      });
    }
  };

  /**
   * Search devices
   */
  searchDevices = async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ 
          success: false,
          message: 'Search query is required' 
        });
      }

      const devices = await deviceService.searchDevices(q);
      
      return res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: devices
      });
    } catch (error) {
      logger.error('Error searching devices:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to search devices', 
        error: error.message 
      });
    }
  };

  /**
   * Update device information
   */
  updateDevice = async (req, res) => {

    console.log("data yang diterima oleh method update : ", req.body)
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!id) {
        return res.status(400).json({ 
          success: false,
          message: 'Device ID is required' 
        });
      }

      const device = await deviceService.updateDevice(id, updateData);
      
      return res.status(200).json({
        success: true,
        message: 'Device updated successfully',
        data: device
      });
    } catch (error) {
      logger.error('Error updating device:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to update device', 
        error: error.message 
      });
    }
  };

  /**
   * Delete device
   */
  deleteDevice = async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ 
          success: false,
          message: 'Device ID is required' 
        });
      }

      const device = await deviceService.deleteDevice(id);
      
      return res.status(200).json({
        success: true,
        message: 'Device deleted successfully',
        data: device
      });
    } catch (error) {
      logger.error('Error deleting device:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to delete device', 
        error: error.message 
      });
    }
  };

  /**
   * Get devices by location
   */
  getDevicesByLocation = async (req, res) => {
    try {
      const { locationId } = req.params;
      
      if (!locationId) {
        return res.status(400).json({ 
          success: false,
          message: 'Location ID is required' 
        });
      }

      const devices = await deviceService.getDevicesByLocation(locationId);
      
      return res.status(200).json({
        success: true,
        message: 'Devices by location retrieved successfully',
        data: devices
      });
    } catch (error) {
      logger.error('Error getting devices by location:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to get devices by location', 
        error: error.message 
      });
    }
  };

  /**
   * Ensure device exists (for MQTT auto-registration)
   * This method is used internally by MQTT handlers
   */
  ensureDeviceExists = async (deviceData) => {
    try {
      const device = await deviceService.ensureDeviceExists(deviceData);
      return device;
    } catch (error) {
      logger.error('Error ensuring device exists:', error);
      throw error;
    }
  };

  /**
   * Force check for offline devices (manual trigger)
   */
  checkOfflineDevices = async (req, res) => {
    try {
      const timeoutMinutes = parseInt(req.query.timeout) || 5;
      
      const offlineDevices = await deviceService.checkAndUpdateOfflineDevices(timeoutMinutes);
      
      return res.status(200).json({
        success: true,
        message: `Offline check completed. ${offlineDevices.length} devices marked as offline`,
        data: {
          offlineDevices,
          timeoutMinutes
        }
      });
    } catch (error) {
      logger.error('Error checking offline devices:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to check offline devices', 
        error: error.message 
      });
    }
  };
}

export const deviceController = new DeviceController();