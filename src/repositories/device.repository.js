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
   * @param {string} data.code - Device code
   * @param {string} data.locationId - Location ID (required)
   * @param {string} [data.description] - Device description (optional)
   * @returns {Promise<Object>} Created device
   */
  async create(data) {
    try {
      return await prisma.device.create({
        data: {
          code: data.code,
          locationId: data.locationId,
          description: data.description,
          status: 'DISCONNECTED', // Default status
          lastSeen: null,
        },
        include: {
          location: {
            select: { name: true, address: true }
          }
        }
      });
    } catch (error) {
      console.log(error)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Duplicate unique field
          throw new Error(`Conflict: Duplicate field "${error.meta?.target}"`);
        }
        if (error.code === 'P2003') {
          // Foreign key constraint failed
          throw new Error(`Invalid locationId: Location not found`);
        }
      }

      if (error instanceof Prisma.PrismaClientValidationError) {
        throw new Error(`Invalid input format: ${error.message}`);
      }
  
      throw error;
    }
  }

  /**
   * Find a device by its unique code
   * @param {string} code - Device code
   * @returns {Promise<Object|null>} Found device or null
   */
  async findByCode(code) {
    try {
      return await prisma.device.findUnique({
        where: { code },
        include: {
          location: {
            select: { 
              id: true,
              name: true, 
              address: true,
              amanMax: true,
              waspadaMin: true,
              waspadaMax: true,
              siagaMin: true,
              siagaMax: true,
              bahayaMin: true,
            }
          }
        }
      });
    } catch (error) {
      logger.error(`Error finding device by Code: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find a device by its unique ID
   * @param {string} id - Device UUID
   * @returns {Promise<Object|null>} Found device or null
   */
  async findById(id) {
    try {
      return await prisma.device.findUnique({
        where: { id },
        include: {
          location: {
            select: { 
              id: true,
              name: true, 
              address: true 
            }
          }
        }
      });
    } catch (error) {
      logger.error(`Error finding device by ID: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get all devices with status information
   * @param {Object} [options] - Query options
   * @param {number} [options.skip] - Number of records to skip
   * @param {number} [options.take] - Number of records to take
   * @returns {Promise<Array>} List of devices with status
   */
  async findAll(options = {}) {
    try {
      const { skip, take } = options;
      
      return await prisma.device.findMany({
        skip: skip ? parseInt(skip) : undefined,
        take: take ? parseInt(take) : undefined,
        include: {
          location: {
            select: { 
              id: true,
              name: true, 
              address: true,
              currentStatus: true,
              currentWaterLevel: true
            }
          }
        },
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
    console.log("data yang diterima oleh method update : ", data)
    try {
      return await prisma.device.update({
        where: { id },
        data: {
          code: data.code,
          locationId: data.locationId,
          description: data.description,
        },
        include: {
          location: {
            select: { name: true, address: true }
          }
        }
      });
    } catch (error) {
      logger.error(`Error updating device: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update device status and lastSeen timestamp
   * @param {string} code - Device code
   * @param {string} status - Device status ('CONNECTED' or 'DISCONNECTED')
   * @param {Date} [lastSeen] - Last seen timestamp
   * @returns {Promise<Object>} Updated device
   */
  async updateStatus(code, status, lastSeen = new Date()) {
    try {
      return await prisma.device.update({
        where: { code },
        data: {
          status,
          lastSeen,
          updatedAt: new Date()
        },
        include: {
          location: {
            select: { name: true }
          }
        }
      });
    } catch (error) {
      logger.error(`Error updating device status: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update lastSeen timestamp for heartbeat
   * @param {string} code - Device code
   * @param {Date} [timestamp] - Heartbeat timestamp
   * @returns {Promise<Object>} Updated device
   */
  async updateHeartbeat(code, timestamp = new Date()) {
    try {
      return await prisma.device.update({
        where: { code },
        data: {
          status: 'CONNECTED',
          lastSeen: timestamp,
          updatedAt: new Date()
        },
        include: {
          location: {
            select: { name: true }
          }
        }
      });
    } catch (error) {
      logger.error(`Error updating device heartbeat: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get devices by status
   * @param {string} status - Device status ('CONNECTED' or 'DISCONNECTED')
   * @returns {Promise<Array>} Devices with specified status
   */
  async findByStatus(status) {
    try {
      return await prisma.device.findMany({
        where: { 
          status,
        },
        include: {
          location: {
            select: { name: true, address: true }
          }
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });
    } catch (error) {
      logger.error(`Error finding devices by status: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get devices that haven't sent heartbeat within threshold
   * @param {number} thresholdMinutes - Minutes of inactivity to consider offline
   * @returns {Promise<Array>} Potentially offline devices
   */
  async findPotentiallyOfflineDevices(thresholdMinutes = 5) {
    try {
      const thresholdTime = new Date();
      thresholdTime.setMinutes(thresholdTime.getMinutes() - thresholdMinutes);

      return await prisma.device.findMany({
        where: {
          AND: [
            { status: 'CONNECTED' },
            {
              OR: [
                { lastSeen: { lt: thresholdTime } },
                { lastSeen: null }
              ]
            }
          ]
        },
        include: {
          location: {
            select: { name: true }
          }
        }
      });
    } catch (error) {
      logger.error(`Error finding potentially offline devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get device status summary (counts by status)
   * @returns {Promise<Object>} Status summary
   */
  async getStatusSummary() {
    try {
      const [connected, disconnected, total, active] = await Promise.all([
        prisma.device.count({ 
          where: { 
            status: 'CONNECTED',
          } 
        }),
        prisma.device.count({ 
          where: { 
            status: 'DISCONNECTED',
          } 
        }),
        prisma.device.count()
      ]);

      return {
        connected,
        disconnected,
        total,
        active
      };
    } catch (error) {
      logger.error(`Error getting status summary: ${error.message}`, error);
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
      // Get the device to access its code
      const device = await this.findById(id);
      if (!device) return;

      // Delete all associated records using transactions for atomicity
      await prisma.$transaction([
        // Delete sensor logs
        prisma.sensorLog.deleteMany({
          where: { deviceCode: device.code }
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
        where: {
          ...filters,
        }
      });
    } catch (error) {
      logger.error(`Error counting devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Search devices by code, description, or location name
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching devices
   */
  async search(query) {
    try {
      return await prisma.device.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  code: {
                    contains: query,
                    mode: 'insensitive'
                  }
                },
                {
                  description: {
                    contains: query,
                    mode: 'insensitive'
                  }
                },
                {
                  location: {
                    name: {
                      contains: query,
                      mode: 'insensitive'
                    }
                  }
                }
              ]
            }
          ]
        },
        include: {
          location: {
            select: { name: true, address: true }
          }
        },
        orderBy: {
          code: 'asc'
        }
      });
    } catch (error) {
      logger.error(`Error searching devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get recently active devices (based on lastSeen)
   * @param {number} hours - Number of hours to look back
   * @param {number} limit - Maximum number of devices to return
   * @returns {Promise<Array>} Recently active devices
   */
  async getRecentlyActiveDevices(hours = 24, limit = 10) {
    try {
      const dateThreshold = new Date();
      dateThreshold.setHours(dateThreshold.getHours() - hours);

      return await prisma.device.findMany({
        where: {
          lastSeen: {
            gte: dateThreshold
          },
        },
        include: {
          location: {
            select: { name: true, address: true }
          }
        },
        orderBy: {
          lastSeen: 'desc'
        },
        take: limit
      });
    } catch (error) {
      logger.error(`Error getting recently active devices: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Bulk update devices status to DISCONNECTED (for cleanup/maintenance)
   * @param {string[]} deviceCodes - Array of device codes
   * @returns {Promise<Object>} Update result
   */
  async bulkUpdateStatusToDisconnected(deviceCodes) {
    try {
      return await prisma.device.updateMany({
        where: {
          code: {
            in: deviceCodes
          },
        },
        data: {
          status: 'DISCONNECTED',
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error(`Error bulk updating device status: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get devices by location ID
   * @param {string} locationId - Location ID
   * @returns {Promise<Array>} Devices in the location
   */
  async findByLocationId(locationId) {
    try {
      return await prisma.device.findMany({
        where: { 
          locationId,
        },
        include: {
          location: {
            select: { name: true, currentStatus: true }
          }
        },
        orderBy: {
          code: 'asc'
        }
      });
    } catch (error) {
      logger.error(`Error finding devices by location: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get default location ID (for auto-created devices)
   * @returns {Promise<string>} Default location ID
   */
  async getDefaultLocationId() {
    try {
      const defaultLocation = await prisma.location.findFirst({
        select: { id: true }
      });
      
      if (!defaultLocation) {
        throw new Error('No active location found. Please create a location first.');
      }
      
      return defaultLocation.id;
    } catch (error) {
      logger.error(`Error getting default location: ${error.message}`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const deviceRepository = new DeviceRepository();