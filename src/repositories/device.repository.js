import { prisma } from "../prisma/prismaClient.js";
import { Prisma } from '@prisma/client';
import logger from '../utils/logger.js';

/**
 * Repository for handling device-related database operations
 */
class DeviceRepository {
  /**
   * Create a new device in the database
   * @param {Object} data - Device data
   * @param {Object} data.id - Device data
   * @param {string} data.deviceCode - Unique device identifier 
   * @param {string} data.code - Device code
   * @param {string} [data.location] - Device location (optional)
   * @returns {Promise<Object>} Created device
   */
  async create(data) {
    try {
      return await prisma.device.create({
        data: {
          code: data.code,
          location: data.location,
          description : data.description
        },
      });
    } catch (error) {
      console.log(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Duplicate unique field
          throw new Error(`Conflict: Duplicate field "${error.meta?.target}"`);
        }
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new Error(`Invalid input format: ${error.message}`);
      }
  
      throw error;
    }
  }

  /**
   * Find a device by its unique ID
   * @param {string} id - Device UUID
   * @returns {Promise<Object|null>} Found device or null
   */
  async findByCode(code) {
    try {
      return await prisma.device.findUnique({
        where: { code },
      });
    } catch (error) {
      logger.error(`Error finding device by Code: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get all devices
   * @param {Object} [options] - Query options
   * @param {number} [options.skip] - Number of records to skip
   * @param {number} [options.take] - Number of records to take
   * @returns {Promise<Array>} List of devices
   */
  async findAll(options = {}) {
    try {
      const { skip, take } = options;
      
      return await prisma.device.findMany({
        skip: skip ? parseInt(skip) : undefined,
        take: take ? parseInt(take) : undefined,
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      logger.error(`Error finding all devices: ${error.message}`, error);
      throw error;
    }
  }


  /**
   * Update device details
   * @param {string} id - Device UUID
   * @param {Object} data - Updated device data
   * @returns {Promise<Object>} Updated device
   */
  async update(id, data) {
    try {
      return await prisma.device.update({
        where: { id },
        data: {
          code: data.code,
          location: data.location
        }
      });
    } catch (error) {
      logger.error(`Error updating device: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete a device
   * @param {string} id - Device UUID
   * @returns {Promise<Object>} Deleted device
   */
  async delete(id) {
    try {
      // First check if the device has associated records that need to be deleted
      await this.deleteAssociatedRecords(id);
      
      // Then delete the device itself
      return await prisma.device.delete({
        where: { id }
      });
    } catch (error) {
      logger.error(`Error deleting device: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Helper method to delete all records associated with a device
   * @param {string} id - Device UUID
   */
  async deleteAssociatedRecords(id) {
    try {
      // Get the device to access its deviceCode
      const device = await this.findById(id);
      if (!device) return;

      // Delete all associated records using transactions for atomicity
      await prisma.$transaction([
        // Delete device status
        prisma.deviceStatus.deleteMany({
          where: { deviceCode: device.deviceCode }
        }),
        // Delete sensor logs
        prisma.sensorLog.deleteMany({
          where: { deviceCode: device.deviceCode }
        }),
        // Delete alerts
        prisma.alert.deleteMany({
          where: { deviceCode: device.deviceCode }
        })
      ]);
    } catch (error) {
      logger.error(`Error deleting associated records: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Count total devices
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<number>} Total count
   */
  async count(filters = {}) {
    try {
      return await prisma.device.count({
        where: filters
      });
    } catch (error) {
      logger.error(`Error counting devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Search devices by code or location
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching devices
   */
  async search(query) {
    try {
      return await prisma.device.findMany({
        where: {
          OR: [
            {
              code: {
                contains: query
              }
            },
            {
              location: {
                contains: query
              }
            },
            {
              deviceCode: {
                contains: query
              }
            }
          ]
        },
        include: {
          status: true
        }
      });
    } catch (error) {
      logger.error(`Error searching devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get devices with recent activity
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum number of devices to return
   * @returns {Promise<Array>} Devices with recent activity
   */
  async getRecentlyActiveDevices(days = 7, limit = 10) {
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      // Get devices with recent sensor logs
      const devicesWithRecentActivity = await prisma.sensorLog.findMany({
        where: {
          timestamp: {
            gte: dateThreshold
          }
        },
        select: {
          deviceCode: true
        },
        distinct: ['deviceCode'],
        take: limit
      });

      // Get full device details for these devices
      const deviceCodes = devicesWithRecentActivity.map(log => log.deviceCode);
      
      return await prisma.device.findMany({
        where: {
          deviceCode: {
            in: deviceCodes
          }
        },
        include: {
          status: true
        }
      });
    } catch (error) {
      logger.error(`Error getting recently active devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get offline devices (devices that haven't reported status recently)
   * @param {number} thresholdMinutes - Minutes of inactivity to consider a device offline
   * @returns {Promise<Array>} Offline devices
   */
  async getOfflineDevices(thresholdMinutes = 30) {
    try {
      const thresholdTime = new Date();
      thresholdTime.setMinutes(thresholdTime.getMinutes() - thresholdMinutes);

      return await prisma.device.findMany({
        where: {
          status: {
            OR: [
              {
                lastSeen: {
                  lt: thresholdTime
                }
              },
              {
                status: 'offline'
              }
            ]
          }
        },
        include: {
          status: true
        }
      });
    } catch (error) {
      logger.error(`Error getting offline devices: ${error.message}`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const deviceRepository = new DeviceRepository();