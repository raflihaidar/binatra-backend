import { locationRepository } from '../repositories/location.repository.js';
import logger from '../utils/logger.js';

class LocationService {
  /**
   * Get all locations
   * @returns {Promise<Array>} List of locations
   */
  async getAllLocations() {
    try {
      return await locationRepository.findAll();
    } catch (error) {
      logger.error('Error in getAllLocations service:', error);
      throw error;
    }
  }

  /**
   * Create new location
   * @param {Object} data - Location data
   * @returns {Promise<Object>} Created location
   */
  async createLocation(data) {
    try {
      return await locationRepository.create(data);
    } catch (error) {
      logger.error('Error in createLocation service:', error);
      throw error;
    }
  }

  /**
   * Get location by ID
   * @param {string} id - Location ID
   * @returns {Promise<Object>} Location
   */
  async getLocationById(id) {
    try {
      const location = await locationRepository.findById(id);
      if (!location) {
        throw new Error(`Location with ID ${id} not found`);
      }
      return location;
    } catch (error) {
      logger.error('Error in getLocationById service:', error);
      throw error;
    }
  }

  /**
   * Get active flood warnings (locations with status != AMAN)
   * @returns {Promise<Array>} Active flood locations
   */
  async getActiveFloodWarnings() {
    try {
      const locations = await locationRepository.findActiveFloodLocations();

      // Add calculated fields for frontend
      return locations.map(location => ({
        ...location,
        timeSinceUpdate: this.calculateTimeSince(location.lastUpdate),
        statusColor: this.getStatusColor(location.currentStatus),
        progressPercentage: this.calculateProgress(location.currentWaterLevel, location.bahayaMin) // Updated to use bahayaMin
      }));
    } catch (error) {
      logger.error('Error in getActiveFloodWarnings service:', error);
      throw error;
    }
  }

  /**
   * Process sensor data and update location status
   * @param {string} deviceCode - Device code
   * @param {number} waterLevel - Water level in cm
   * @param {number} rainfall - Rainfall in mm/h
   * @returns {Promise<Object>} Update result
   */
  async processSensorData(deviceCode, waterLevel, rainfall) {
    try {
      // 1. Get location by device code
      const location = await locationRepository.findByDeviceCode(deviceCode);
      if (!location) {
        throw new Error(`Location not found for device ${deviceCode}`);
      }

      // 2. Calculate new flood status
      const newStatus = this.calculateFloodStatus(waterLevel, location);
      const previousStatus = location.currentStatus;

      // 3. Update location current status
      const updatedLocation = await locationRepository.updateCurrentStatus(location.id, {
        currentStatus: newStatus,
        currentWaterLevel: waterLevel,
        currentRainfall: rainfall
      });

      // 4. Create status history if status changed
      if (previousStatus !== newStatus) {
        await this.createStatusHistory(location.id, previousStatus, newStatus, waterLevel, rainfall);

        logger.info(`Location status changed: ${location.name} from ${previousStatus} to ${newStatus}`, {
          locationId: location.id,
          deviceCode,
          waterLevel,
          rainfall
        });
      }

      return {
        location: updatedLocation,
        statusChanged: previousStatus !== newStatus,
        previousStatus,
        newStatus
      };
    } catch (error) {
      logger.error('Error in processSensorData service:', error);
      throw error;
    }
  }

  /**
   * Calculate flood status based on water level and thresholds
   * @param {number} waterLevel - Current water level
   * @param {Object} location - Location with thresholds
   * @returns {string} Flood status
   */
  calculateFloodStatus(waterLevel, location) {
    // Menggunakan field threshold baru sesuai schema Prisma yang updated
    if (waterLevel >= location.bahayaMin) {
      return 'BAHAYA';
    } else if (waterLevel >= location.siagaMin && waterLevel <= location.siagaMax) {
      return 'SIAGA';
    } else if (waterLevel >= location.waspadaMin && waterLevel <= location.waspadaMax) {
      return 'WASPADA';
    } else if (waterLevel <= location.amanMax) {
      return 'AMAN';
    } else {
      // Fallback case - jika waterLevel di antara range yang tidak terdefinisi
      // Misalnya waterLevel > amanMax tapi < waspadaMin
      return 'AMAN';
    }
  }

  /**
   * Create status history record
   * @param {string} locationId - Location ID
   * @param {string} previousStatus - Previous status
   * @param {string} newStatus - New status
   * @param {number} waterLevel - Water level
   * @param {number} rainfall - Rainfall
   * @returns {Promise<Object>} History record
   */
  async createStatusHistory(locationId, previousStatus, newStatus, waterLevel, rainfall) {
    try {
      // Calculate duration in previous status
      const location = await locationRepository.findById(locationId);
      const duration = location.lastUpdate ?
        Math.floor((new Date() - new Date(location.lastUpdate)) / (1000 * 60)) : 0;

      return await locationRepository.createStatusHistory({
        locationId,
        previousStatus,
        newStatus,
        waterLevel,
        rainfall,
        duration,
        changedAt: new Date()
      });
    } catch (error) {
      logger.error('Error creating status history:', error);
      throw error;
    }
  }

  /**
   * Get flood summary statistics
   * @returns {Promise<Object>} Summary statistics
   */
  async getFloodSummary() {
    try {
      return await locationRepository.getFloodSummary();
    } catch (error) {
      logger.error('Error in getFloodSummary service:', error);
      throw error;
    }
  }

  /**
     * Get all location status history with pagination and filters
     * @param {Object} params - Query parameters
     * @returns {Object} Result with data and pagination
     */
  async getAllLocationStatusHistory(params = {}) {
    try {
      // Validate and sanitize parameters
      const validatedParams = this.validateGetAllParams(params);

      logger.info('Fetching location status history', {
        page: validatedParams.page,
        limit: validatedParams.limit,
        status: validatedParams.status,
        dateRange: validatedParams.startDate && validatedParams.endDate ?
          `${validatedParams.startDate} to ${validatedParams.endDate}` : 'all'
      });

      // Call repository method
      const result = await locationRepository.getLocationStatusHistory(validatedParams);

      if (result.success) {
        logger.info('Location status history fetched successfully', {
          totalItems: result.pagination?.totalItems || 0,
          currentPage: result.pagination?.currentPage || 1
        });
      } else {
        logger.error('Failed to fetch location status history:', result.error);
      }

      return result;

    } catch (error) {
      logger.error('Error in getAllLocationStatusHistory service:', error);
      return {
        success: false,
        error: 'Failed to retrieve location status history',
        data: [],
        pagination: null
      };
    }
  }


  /**
 * Validate parameters for getAllLocationStatusHistory
 */
validateGetAllParams(params) {
  const {
    page = 1,
    limit = 10,
    status = null,
    startDate = null,
    endDate = null,
    sortBy = 'changedAt',
    sortOrder = 'desc'
  } = params;

  // Validate pagination
  const validPage = Math.max(1, parseInt(page) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));

  // Validate sort parameters
  const validSortFields = ['changedAt', 'previousStatus', 'newStatus', 'waterLevel', 'rainfall', 'duration'];
  const validSortOrders = ['asc', 'desc'];
  
  const validSortBy = validSortFields.includes(sortBy) ? sortBy : 'changedAt';
  const validSortOrder = validSortOrders.includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

  // Validate status
  const validStatuses = ['AMAN', 'WASPADA', 'SIAGA', 'BAHAYA'];
  const validStatus = validStatuses.includes(status) ? status : null;

  return {
    page: validPage,
    limit: validLimit,
    status: validStatus,
    startDate,
    endDate,
    sortBy: validSortBy,
    sortOrder: validSortOrder
  };
}



  /**
   * Update location thresholds
   * @param {string} locationId - Location ID
   * @param {Object} thresholds - New threshold values
   * @returns {Promise<Object>} Updated location
   */
  async updateThresholds(locationId, thresholds) {
    try {
      return await locationRepository.updateThresholds(locationId, thresholds);
    } catch (error) {
      logger.error('Error in updateThresholds service:', error);
      throw error;
    }
  }

  /**
   * Search locations
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching locations
   */
  async searchLocations(query) {
    try {
      return await locationRepository.search(query);
    } catch (error) {
      logger.error('Error in searchLocations service:', error);
      throw error;
    }
  }

  // Helper methods for frontend calculations
  calculateTimeSince(lastUpdate) {
    if (!lastUpdate) return 'No data';

    const now = new Date();
    const updateTime = new Date(lastUpdate);
    const diffMinutes = Math.floor((now - updateTime) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  getStatusColor(status) {
    const colors = {
      'AMAN': 'green',
      'WASPADA': 'yellow',
      'SIAGA': 'orange', // Added SIAGA status
      'BAHAYA': 'red'
    };
    return colors[status] || 'gray';
  }

  calculateProgress(currentLevel, maxLevel) {
    if (!currentLevel || !maxLevel) return 0;
    return Math.min((currentLevel / maxLevel) * 100, 100);
  }

  /**
   * Get threshold info for a specific water level
   * @param {number} waterLevel - Current water level
   * @param {Object} location - Location with thresholds
   * @returns {Object} Threshold information
   */
  getThresholdInfo(waterLevel, location) {
    const status = this.calculateFloodStatus(waterLevel, location);

    let nextThreshold = null;
    let nextThresholdName = null;
    let progressToNext = 0;

    switch (status) {
      case 'AMAN':
        nextThreshold = location.waspadaMin;
        nextThresholdName = 'WASPADA';
        progressToNext = (waterLevel / location.waspadaMin) * 100;
        break;
      case 'WASPADA':
        nextThreshold = location.siagaMin;
        nextThresholdName = 'SIAGA';
        progressToNext = ((waterLevel - location.waspadaMin) / (location.siagaMin - location.waspadaMin)) * 100;
        break;
      case 'SIAGA':
        nextThreshold = location.bahayaMin;
        nextThresholdName = 'BAHAYA';
        progressToNext = ((waterLevel - location.siagaMin) / (location.bahayaMin - location.siagaMin)) * 100;
        break;
      case 'BAHAYA':
        nextThreshold = null;
        nextThresholdName = null;
        progressToNext = 100;
        break;
    }

    return {
      currentStatus: status,
      nextThreshold,
      nextThresholdName,
      progressToNext: Math.min(progressToNext, 100),
      thresholds: {
        amanMax: location.amanMax,
        waspadaMin: location.waspadaMin,
        waspadaMax: location.waspadaMax,
        siagaMin: location.siagaMin,
        siagaMax: location.siagaMax,
        bahayaMin: location.bahayaMin
      }
    };
  }

  async calculateTotalLocations() {
    return await locationRepository.countLocation()
  }
}

export const locationService = new LocationService();