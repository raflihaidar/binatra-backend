import { prisma } from "../prisma/prismaClient.js";
import logger from '../utils/logger.js';

/**
 * Repository for handling location-related database operations
 */
class LocationRepository {

  /**
   * Get all active locations
   * @returns {Promise<Array>} List of active locations
   */
  async findAll() {
    try {
      return await prisma.location.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      logger.error('Error finding all locations:', error);
      throw error;
    }
  }
  
  /**
   * Create a new location
   * @param {Object} data - Location data
   * @returns {Promise<Object>} Created location
   */
  async create(data) {
    try {
      return await prisma.location.create({
        data: {
          name: data.name,
          address: data.address,
          district: data.district,
          city: data.city,
          province: data.province,
          latitude: data.latitude,
          longitude: data.longitude,
          amanMax: data.amanMax || 79,
          waspadaMin: data.waspadaMin || 80,
          waspadaMax: data.waspadaMax || 149,
          siagaMin: data.siagaMin || 150,
          siagaMax: data.siagaMax || 199,
          bahayaMin: data.bahayaMin || 200
        }
      });
    } catch (error) {
      logger.error('Error creating location:', error);
      throw error;
    }
  }

  /**
 * Update location by ID
 * @param {string} id - Location ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated location
 */
  async update(id, data) {
    try {
      return await prisma.location.update({
        where: { id },
        data,
        include: {
          devices: true,
          statusHistory: {
            orderBy: { changedAt: 'desc' },
            take: 5
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2025') {
        const notFoundError = new Error('Location not found');
        notFoundError.code = 'LOCATION_NOT_FOUND';
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      logger.error('Error in update location repository:', error);
      throw error;
    }
  }

  /**
 * Delete location by ID
 * @param {string} id - Location ID
 * @returns {Promise<Object>} Deleted location info
 */
  async delete(id) {
    try {
      // Get location info before deletion for response
      const location = await prisma.location.findUnique({
        where: { id },
        include: {
          devices: true,
          statusHistory: true
        }
      });

      if (!location) {
        const error = new Error('Location not found');
        error.code = 'LOCATION_NOT_FOUND';
        error.statusCode = 404;
        throw error;
      }

      // Delete the location (cascade will handle devices, statusHistory will be set to null)
      await prisma.location.delete({
        where: { id }
      });

      return {
        message: 'Location deleted successfully',
        deletedLocation: {
          id: location.id,
          name: location.name,
          devicesCount: location.devices.length,
          statusHistoryCount: location.statusHistory.length
        }
      };
    } catch (error) {
      if (error.code === 'P2025') {
        const notFoundError = new Error('Location not found');
        notFoundError.code = 'LOCATION_NOT_FOUND';
        notFoundError.statusCode = 404;
        throw notFoundError;
      }
      logger.error('Error in delete location repository:', error);
      throw error;
    }
  }

  /**
   * Find location by ID
   * @param {string} id - Location ID
   * @returns {Promise<Object|null>} Location or null
   */
  async findById(id) {
    try {
      return await prisma.location.findUnique({
        where: { id },
        include: {
          devices: {
            select: { code: true, status: true, lastSeen: true }
          }
        }
      });
    } catch (error) {
      logger.error('Error finding location by ID:', error);
      throw error;
    }
  }

  /**
   * Get all active locations without any connected devices
   * @returns {Promise<Array>} List of active locations without devices
   */
  async findLocationsWithoutDevices() {
    try {
      return await prisma.location.findMany({
        where: {
          isActive: true,
          devices: {
            none: {}
          }
        },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          address: true,
          district: true,
          city: true,
          province: true,
          latitude: true,
          longitude: true,
          currentStatus: true,
          currentWaterLevel: true,
          currentRainfall: true,
          lastUpdate: true,
          createdAt: true,
        }
      });
    } catch (error) {
      logger.error('Error finding locations without devices:', error);
      throw error;
    }
  }


  /**
 * Check if location exists by unique constraints
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Object|null>} Existing location or null
 */
  async findByUniqueData(criteria) {
    try {
      const { name, city, district, latitude, longitude } = criteria;

      // Check by name, city, district
      if (name && city && district) {
        const existingByName = await prisma.location.findFirst({
          where: {
            name,
            city,
            district
          }
        });
        if (existingByName) return existingByName;
      }

      // Check by coordinates
      if (latitude && longitude) {
        const existingByCoords = await prisma.location.findFirst({
          where: {
            latitude,
            longitude
          }
        });
        if (existingByCoords) return existingByCoords;
      }

      return null;
    } catch (error) {
      logger.error('Error in findByUniqueData repository:', error);
      throw error;
    }
  }


  async countLocation() {
    try {
      return await prisma.location.count({
        where: {
          isActive: true
        }
      })
    } catch (error) {
      logger.error('Error counting locations : ', error)
    }
  }

  /**
   * Get locations with flood status (not AMAN)
   * @returns {Promise<Array>} Locations with active flood warnings
   */
  async findActiveFloodLocations() {
    try {
      return await prisma.location.findMany({
        where: {
          currentStatus: { not: 'AMAN' },
          isActive: true
        },
        select: {
          id: true,
          name: true,
          currentStatus: true,
          currentWaterLevel: true,
          currentRainfall: true,
          lastUpdate: true,
          amanMax: true,
          waspadaMin: true,
          waspadaMax: true,
          siagaMin: true,
          siagaMax: true,
          bahayaMin: true
        },
        orderBy: [
          { currentStatus: 'desc' }, // BAHAYA first
          { lastUpdate: 'desc' }
        ]
      });
    } catch (error) {
      logger.error('Error finding active flood locations:', error);
      throw error;
    }
  }

  /**
   * Update location current status and sensor data
   * @param {string} locationId - Location ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated location
   */
  async updateCurrentStatus(locationId, data) {
    try {
      return await prisma.location.update({
        where: { id: locationId },
        data: {
          currentStatus: data.currentStatus,
          currentWaterLevel: data.currentWaterLevel,
          currentRainfall: data.currentRainfall,
          lastUpdate: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error updating location status:', error);
      throw error;
    }
  }

  /**
   * Create location status history record
   * @param {Object} historyData - History data
   * @returns {Promise<Object>} Created history record
   */
  async createStatusHistory(historyData) {
    try {
      return await prisma.locationStatusHistory.create({
        data: historyData
      });
    } catch (error) {
      logger.error('Error creating status history:', error);
      throw error;
    }
  }

  async getLocationStatusHistory(params = {}) {
    const {
      page = 1,
      limit = 10,
      status = null,
      startDate = null,
      endDate = null,
      sortBy = 'changedAt',
      sortOrder = 'desc'
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause = {};

    // Exclude AMAN status kecuali jika specifically diminta
    if (status) {
      whereClause.OR = [
        { previousStatus: status },
        { newStatus: status }
      ];
    } else {
      // Default: hanya tampilkan status WASPADA, SIAGA, BAHAYA
      whereClause.newStatus = {
        in: ['WASPADA', 'SIAGA', 'BAHAYA']
      };
    }

    if (startDate || endDate) {
      whereClause.changedAt = {};
      if (startDate) whereClause.changedAt.gte = new Date(startDate);
      if (endDate) whereClause.changedAt.lte = new Date(endDate);
    }

    try {
      // Get data with pagination
      const [data, total] = await Promise.all([
        prisma.locationStatusHistory.findMany({
          where: whereClause,
          include: {
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                district: true,
                city: true,
                province: true
              }
            }
          },
          orderBy: {
            [sortBy]: sortOrder
          },
          skip: skip,
          take: parseInt(limit)
        }),
        prisma.locationStatusHistory.count({
          where: whereClause
        })
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        data: data,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: hasNextPage,
          hasPreviousPage: hasPreviousPage,
          nextPage: hasNextPage ? page + 1 : null,
          previousPage: hasPreviousPage ? page - 1 : null
        }
      };

    } catch (error) {
      console.error('Error fetching location status history:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: null
      };
    }
  }


  /**
   * Get location by device code
   * @param {string} deviceCode - Device code
   * @returns {Promise<Object|null>} Location with device info
   */
  async findByDeviceCode(deviceCode) {
    try {
      const device = await prisma.device.findUnique({
        where: { code: deviceCode },
        include: {
          location: true
        }
      });

      return device ? device.location : null;
    } catch (error) {
      logger.error('Error finding location by device code:', error);
      throw error;
    }
  }

  /**
   * Count flood locations by status
   * @returns {Promise<Object>} Count summary
   */
  async getFloodSummary() {
    try {
      const [total, aman, waspada, siaga, bahaya] = await Promise.all([
        prisma.location.count({ where: { isActive: true } }),
        prisma.location.count({ where: { currentStatus: 'AMAN', isActive: true } }),
        prisma.location.count({ where: { currentStatus: 'WASPADA', isActive: true } }),
        prisma.location.count({ where: { currentStatus: 'SIAGA', isActive: true } }),
        prisma.location.count({ where: { currentStatus: 'BAHAYA', isActive: true } })
      ]);

      return {
        total,
        aman,
        waspada,
        siaga,
        bahaya,
        flooding: waspada + siaga + bahaya
      };
    } catch (error) {
      logger.error('Error getting flood summary:', error);
      throw error;
    }
  }

  /**
   * Update location threshold settings
   * @param {string} locationId - Location ID
   * @param {Object} thresholds - Threshold data
   * @returns {Promise<Object>} Updated location
   */
  async updateThresholds(locationId, thresholds) {
    try {
      return await prisma.location.update({
        where: { id: locationId },
        data: {
          amanMax: thresholds.amanMax,
          waspadaMin: thresholds.waspadaMin,
          waspadaMax: thresholds.waspadaMax,
          siagaMin: thresholds.siagaMin,
          siagaMax: thresholds.siagaMax,
          bahayaMin: thresholds.bahayaMin,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error updating location thresholds:', error);
      throw error;
    }
  }

  /**
   * Search locations by name or address
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching locations
   */
  async search(query) {
    try {
      return await prisma.location.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { address: { contains: query, mode: 'insensitive' } },
            { district: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } }
          ],
          isActive: true
        },
        orderBy: { name: 'asc' }
      });
    } catch (error) {
      logger.error('Error searching locations:', error);
      throw error;
    }
  }
}

export const locationRepository = new LocationRepository();