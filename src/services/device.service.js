import { deviceRepository } from '../repositories/device.repository.js';
import logger from '../utils/logger.js';

class DeviceService {
    /**
     * Get all devices with status information
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of devices
     */
    async getAllDevice(options = {}) {
        try {
            return await deviceRepository.findAll(options);
        } catch (error) {
            logger.error('Error in getAllDevice service:', error);
            throw error;
        }
    }

    /**
     * Create a new device
     * @param {Object} data - Device data
     * @returns {Promise<Object>} Created device
     */
    async createDevice(data) {
        try {
            // Check if device with same code already exists
            const existingDevice = await deviceRepository.findByCode(data.code);

            if (existingDevice) {
                const error = new Error('Device with this code already exists');
                error.code = 'DEVICE_EXISTS';
                error.statusCode = 409;
                error.details = {
                    existingDevice: {
                        id: existingDevice.id,
                        code: existingDevice.code,
                        description: existingDevice.description,
                        location: existingDevice.location
                    }
                };
                throw error;
            }

            // If no locationId provided, get default location
            if (!data.locationId) {
                data.locationId = await deviceRepository.getDefaultLocationId();
            }

            return await deviceRepository.create(data);
        } catch (error) {
            logger.error('Error in createDevice service:', error);
            throw error;
        }
    }

    /**
     * Find device by code
     * @param {string} code - Device code
     * @returns {Promise<Object|null>} Found device or null
     */
    async findByCode(code) {
        try {
            const device = await deviceRepository.findByCode(code);
            if (!device) {
                throw new Error(`Device with code ${code} not found`);
            }
            return device;
        } catch (error) {
            logger.error('Error in findByCode service:', error);
            throw error;
        }
    }

    /**
     * Update device heartbeat (mark as connected)
     * @param {string} code - Device code
     * @param {Date} timestamp - Heartbeat timestamp
     * @returns {Promise<Object>} Updated device
     */
    async updateHeartbeat(code, timestamp = new Date()) {
        try {
            // Check if device exists first
            await this.findByCode(code);

            return await deviceRepository.updateHeartbeat(code, timestamp);
        } catch (error) {
            logger.error('Error in updateHeartbeat service:', error);
            throw error;
        }
    }

    /**
     * Update device status
     * @param {string} code - Device code
     * @param {string} status - Device status ('CONNECTED' or 'DISCONNECTED')
     * @param {Date} lastSeen - Last seen timestamp
     * @returns {Promise<Object>} Updated device
     */
    async updateStatus(code, status, lastSeen = new Date()) {
        try {
            return await deviceRepository.updateStatus(code, status, lastSeen);
        } catch (error) {
            logger.error('Error in updateStatus service:', error);
            throw error;
        }
    }

    /**
     * Get devices by status
     * @param {string} status - Device status
     * @returns {Promise<Array>} Devices with specified status
     */
    async getDevicesByStatus(status) {
        try {
            return await deviceRepository.findByStatus(status);
        } catch (error) {
            logger.error('Error in getDevicesByStatus service:', error);
            throw error;
        }
    }

    /**
     * Get connected devices
     * @returns {Promise<Array>} Connected devices
     */
    async getConnectedDevices() {
        try {
            return await deviceRepository.findByStatus('CONNECTED');
        } catch (error) {
            logger.error('Error in getConnectedDevices service:', error);
            throw error;
        }
    }

    /**
     * Get disconnected devices
     * @returns {Promise<Array>} Disconnected devices
     */
    async getDisconnectedDevices() {
        try {
            return await deviceRepository.findByStatus('DISCONNECTED');
        } catch (error) {
            logger.error('Error in getDisconnectedDevices service:', error);
            throw error;
        }
    }

    /**
     * Check and update offline devices based on heartbeat timeout
     * @param {number} timeoutMinutes - Minutes to consider device offline
     * @returns {Promise<Array>} Devices that were marked as offline
     */
    async checkAndUpdateOfflineDevices(timeoutMinutes = 5) {
        try {
            const potentiallyOfflineDevices = await deviceRepository.findPotentiallyOfflineDevices(timeoutMinutes);

            const offlineDeviceCodes = potentiallyOfflineDevices.map(device => device.code);

            if (offlineDeviceCodes.length > 0) {
                await deviceRepository.bulkUpdateStatusToDisconnected(offlineDeviceCodes);
                logger.info(`Marked ${offlineDeviceCodes.length} devices as DISCONNECTED due to timeout`, {
                    deviceCodes: offlineDeviceCodes,
                    timeoutMinutes
                });
            }

            return potentiallyOfflineDevices;
        } catch (error) {
            logger.error('Error in checkAndUpdateOfflineDevices service:', error);
            throw error;
        }
    }

    /**
     * Get device status summary
     * @returns {Promise<Object>} Status summary
     */
    async getStatusSummary() {
        try {
            return await deviceRepository.getStatusSummary();
        } catch (error) {
            logger.error('Error in getStatusSummary service:', error);
            throw error;
        }
    }

    /**
     * Get recently active devices
     * @param {number} hours - Hours to look back
     * @param {number} limit - Maximum number of devices
     * @returns {Promise<Array>} Recently active devices
     */
    async getRecentlyActiveDevices(hours = 24, limit = 10) {
        try {
            return await deviceRepository.getRecentlyActiveDevices(hours, limit);
        } catch (error) {
            logger.error('Error in getRecentlyActiveDevices service:', error);
            throw error;
        }
    }

    /**
     * Search devices
     * @param {string} query - Search query
     * @returns {Promise<Array>} Matching devices
     */
    async searchDevices(query) {
        try {
            return await deviceRepository.search(query);
        } catch (error) {
            logger.error('Error in searchDevices service:', error);
            throw error;
        }
    }

    /**
     * Update device information
     * @param {string} id - Device ID
     * @param {Object} data - Updated data
     * @returns {Promise<Object>} Updated device
     */
    async updateDevice(id, data) {
        try {
            return await deviceRepository.update(id, data);
        } catch (error) {
            logger.error('Error in updateDevice service:', error);
            throw error;
        }
    }

    /**
     * Delete device
     * @param {string} id - Device ID
     * @returns {Promise<Object>} Deleted device
     */
    async deleteDevice(id) {
        try {
            return await deviceRepository.delete(id);
        } catch (error) {
            logger.error('Error in deleteDevice service:', error);
            throw error;
        }
    }

    /**
     * Check if device exists and create if not (for MQTT auto-registration)
     * @param {Object} deviceData - Device data from MQTT
     * @returns {Promise<Object>} Device (existing or newly created)
     */
    async ensureDeviceExists(deviceData) {
        try {
            const { code, description, location } = deviceData;

            // Try to find existing device
            try {
                const existingDevice = await this.findByCode(code);
                if (existingDevice) {
                    // Update heartbeat for existing device
                    return await this.updateHeartbeat(code);
                }
            } catch (error) {
                // Device doesn't exist, create new one
                logger.info(`Device ${code} not found, creating new device`);
            }

            // Get default location for new device
            const defaultLocationId = await deviceRepository.getDefaultLocationId();

            // Create new device
            const newDevice = await this.createDevice({
                code,
                description: description || `Auto-created device ${code}`,
                locationId: defaultLocationId
            });

            logger.info(`New device created: ${code}`, {
                deviceId: newDevice.id,
                locationId: newDevice.locationId,
                locationName: newDevice.location?.name
            });
            return newDevice;

        } catch (error) {
            logger.error('Error in ensureDeviceExists service:', error);
            throw error;
        }
    }

    /**
     * Get devices by location
     * @param {string} locationId - Location ID
     * @returns {Promise<Array>} Devices in the location
     */
    async getDevicesByLocation(locationId) {
        try {
            return await deviceRepository.findByLocationId(locationId);
        } catch (error) {
            logger.error('Error in getDevicesByLocation service:', error);
            throw error;
        }
    }
}

export const deviceService = new DeviceService();