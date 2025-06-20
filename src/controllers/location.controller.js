import { locationService } from '../services/location.service.js';
import logger from '../utils/logger.js';

class LocationController {
  /**
   * Get all locations
   */
  getAllLocations = async (req, res) => {
    try {
      const locations = await locationService.getAllLocations();

      return res.status(200).json({
        success: true,
        message: 'Locations retrieved successfully',
        data: locations
      });
    } catch (error) {
      logger.error('Error getting locations:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get locations',
        error: error.message
      });
    }
  };

  async getAllLocationStatusHistory(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        startDate,
        endDate,
        sortBy = 'changedAt',
        sortOrder = 'desc'
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page

      // Validate sort parameters
      const validSortFields = ['changedAt', 'previousStatus', 'newStatus', 'waterLevel', 'rainfall'];
      const validSortOrders = ['asc', 'desc'];

      const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'changedAt';
      const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'desc';

      // Validate status parameter
      const validStatuses = ['AMAN', 'WASPADA', 'SIAGA', 'BAHAYA'];
      const finalStatus = validStatuses.includes(status) ? status : null;

      const result = await locationService.getAllLocationStatusHistory({
        page: pageNum,
        limit: limitNum,
        status: finalStatus,
        startDate,
        endDate,
        sortBy: finalSortBy,
        sortOrder: finalSortOrder
      });

      if (result.success) {
        logger.info('Location status history retrieved successfully', {
          page: pageNum,
          limit: limitNum,
          totalItems: result.pagination?.totalItems || 0
        });

        res.status(200).json({
          success: true,
          message: 'Location status history retrieved successfully',
          data: result.data,
          pagination: result.pagination
        });
      } else {
        logger.error('Failed to retrieve location status history:', result.error);
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve location status history',
          error: result.error
        });
      }

    } catch (error) {
      logger.error('Error in getAllLocationStatusHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }


  /**
   * Create new location
   */
  createLocation = async (req, res) => {
    try {
      const {
        name,
        address,
        district,
        city,
        province,
        latitude,
        longitude,
        normalLevel,
        alertLevel,
        dangerLevel,
        criticalLevel
      } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Location name is required'
        });
      }

      const location = await locationService.createLocation({
        name,
        address,
        district,
        city,
        province,
        latitude,
        longitude,
        normalLevel,
        alertLevel,
        dangerLevel,
        criticalLevel
      });

      return res.status(201).json({
        success: true,
        message: 'Location created successfully',
        data: location
      });
    } catch (error) {
      logger.error('Error creating location:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create location',
        error: error.message
      });
    }
  };

  /**
   * Get location by ID
   */
  getLocationById = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      const location = await locationService.getLocationById(id);

      return res.status(200).json({
        success: true,
        message: 'Location found',
        data: location
      });
    } catch (error) {
      logger.error('Error getting location by ID:', error);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({
        success: false,
        message: 'Failed to get location',
        error: error.message
      });
    }
  };

  /**
   * Get active flood warnings (for dashboard cards)
   */
  getActiveFloodWarnings = async (req, res) => {
    try {
      const warnings = await locationService.getActiveFloodWarnings();

      return res.status(200).json({
        success: true,
        message: 'Active flood warnings retrieved successfully',
        data: warnings,
        count: warnings.length
      });
    } catch (error) {
      logger.error('Error getting active flood warnings:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get flood warnings',
        error: error.message
      });
    }
  };

  /**
   * Get flood summary statistics
   */
  getFloodSummary = async (req, res) => {
    try {
      const summary = await locationService.getFloodSummary();

      return res.status(200).json({
        success: true,
        message: 'Flood summary retrieved successfully',
        data: summary
      });
    } catch (error) {
      logger.error('Error getting flood summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get flood summary',
        error: error.message
      });
    }
  };

  /**
   * Process sensor data (called internally by MQTT handler)
   * This method is used by the MQTT system to update location status
   */
  processSensorData = async (deviceCode, waterLevel, rainfall) => {
    try {
      const result = await locationService.processSensorData(deviceCode, waterLevel, rainfall);

      logger.info('Sensor data processed successfully', {
        deviceCode,
        waterLevel,
        rainfall,
        locationName: result.location.name,
        statusChanged: result.statusChanged,
        newStatus: result.newStatus
      });

      return result;
    } catch (error) {
      logger.error('Error processing sensor data:', error);
      throw error;
    }
  };

  /**
   * Update location thresholds
   */
  updateThresholds = async (req, res) => {
    try {
      const { id } = req.params;
      const { normalLevel, alertLevel, dangerLevel, criticalLevel } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      const location = await locationService.updateThresholds(id, {
        normalLevel,
        alertLevel,
        dangerLevel,
        criticalLevel
      });

      return res.status(200).json({
        success: true,
        message: 'Location thresholds updated successfully',
        data: location
      });
    } catch (error) {
      logger.error('Error updating location thresholds:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update location thresholds',
        error: error.message
      });
    }
  };

  /**
   * Search locations
   */
  searchLocations = async (req, res) => {
    try {
      const { q } = req.query;

      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      const locations = await locationService.searchLocations(q);

      return res.status(200).json({
        success: true,
        message: 'Location search completed successfully',
        data: locations,
        count: locations.length
      });
    } catch (error) {
      logger.error('Error searching locations:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to search locations',
        error: error.message
      });
    }
  };

  /**
   * Force update location status (for testing/manual override)
   */
  forceUpdateStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { waterLevel, rainfall } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      if (waterLevel === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Water level is required'
        });
      }

      // Get location to find a device for processing
      const location = await locationService.getLocationById(id);
      if (!location.devices || location.devices.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No devices found for this location'
        });
      }

      // Use first device code for processing
      const deviceCode = location.devices[0].code;
      const result = await this.processSensorData(deviceCode, waterLevel, rainfall || 0);

      return res.status(200).json({
        success: true,
        message: 'Location status updated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error force updating location status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update location status',
        error: error.message
      });
    }
  };

  getTotalLocation = async (req, res) => {
    try {
      const total = await locationService.calculateTotalLocations();

      return res.status(200).json({
        success: true,
        message: 'Total locations retrieved successfully',
        total
      });
      
    } catch (error) {
      logger.error('Error getting total locations:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get locations',
        error: error.message
      });
    }
  }
}

export const locationController = new LocationController();