import { sensorLogRepository } from '../repositories/sensorLog.repository.js';
import logger from '../utils/logger.js';

class SensorLogService {
  async createSensorLog(data) {
    try {
      // Validasi input
      if (!data.deviceId) {
        throw new Error('Device ID is required');
      }

      // Validasi bahwa setidaknya salah satu sensor data ada
      if (data.rainfall === undefined && data.waterLevel === undefined) {
        throw new Error('At least one of rainfall or waterLevel must be provided');
      }

      // Prepare data
      const sensorData = {
        deviceId: data.deviceId,
        rainfall: data.rainfall !== undefined ? parseFloat(data.rainfall) : null,
        waterLevel: data.waterLevel !== undefined ? parseFloat(data.waterLevel) : null,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
      };

      logger.info(`Creating sensor log for device ${data.deviceId}`, sensorData);
      return await sensorLogRepository.create(sensorData);
    } catch (error) {
      logger.error('Error creating sensor log:', error);
      throw error;
    }
  }

  async createMultipleSensorLogs(logsData) {
    try {
      if (!Array.isArray(logsData) || logsData.length === 0) {
        throw new Error('Logs array is required and cannot be empty');
      }

      // Validasi dan prepare data
      const sensorLogsData = logsData.map(log => {
        if (!log.deviceId) {
          throw new Error('Device ID is required for all logs');
        }

        return {
          deviceId: log.deviceId,
          rainfall: log.rainfall !== undefined ? parseFloat(log.rainfall) : null,
          waterLevel: log.waterLevel !== undefined ? parseFloat(log.waterLevel) : null,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date()
        };
      });

      logger.info(`Creating ${logsData.length} sensor logs`);
      return await sensorLogRepository.createMany(sensorLogsData);
    } catch (error) {
      logger.error('Error creating multiple sensor logs:', error);
      throw error;
    }
  }

  async getSensorLogsByDevice(deviceId) {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      logger.info(`Getting sensor logs for device ${deviceId}`);
      return await sensorLogRepository.findByDeviceId(deviceId);
    } catch (error) {
      logger.error(`Error getting sensor logs for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getLatestSensorLogs(deviceId, limit = 10) {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      logger.info(`Getting latest ${limit} sensor logs for device ${deviceId}`);
      return await sensorLogRepository.findLatestByDeviceId(deviceId, parseInt(limit));
    } catch (error) {
      logger.error(`Error getting latest sensor logs for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getSensorLogsByDateRange(deviceId, startDate, endDate) {
    try {
      if (!deviceId || !startDate || !endDate) {
        throw new Error('Device ID, start date, and end date are required');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new Error('Start date cannot be later than end date');
      }

      logger.info(`Getting sensor logs for device ${deviceId} from ${startDate} to ${endDate}`);
      return await sensorLogRepository.findByDateRange(deviceId, start, end);
    } catch (error) {
      logger.error(`Error getting sensor logs by date range for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getSensorLogStatistics(deviceId, startDate, endDate) {
    try {
      if (!deviceId || !startDate || !endDate) {
        throw new Error('Device ID, start date, and end date are required');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new Error('Start date cannot be later than end date');
      }

      logger.info(`Getting statistics for device ${deviceId} from ${startDate} to ${endDate}`);
      return await sensorLogRepository.getStatistics(deviceId, start, end);
    } catch (error) {
      logger.error(`Error getting statistics for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getHourlyAverage(deviceId, date) {
    try {
      if (!deviceId || !date) {
        throw new Error('Device ID and date are required');
      }

      const targetDate = new Date(date);
      logger.info(`Getting hourly average for device ${deviceId} on ${date}`);
      return await sensorLogRepository.getHourlyAverage(deviceId, targetDate);
    } catch (error) {
      logger.error(`Error getting hourly average for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getDailyAverage(deviceId, month, year) {
    try {
      if (!deviceId || !month || !year) {
        throw new Error('Device ID, month, and year are required');
      }

      logger.info(`Getting daily average for device ${deviceId} in ${month}/${year}`);
      return await sensorLogRepository.getDailyAverage(deviceId, parseInt(month), parseInt(year));
    } catch (error) {
      logger.error(`Error getting daily average for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getHighRainfallAlerts(threshold = 5.0, deviceId = null) {
    try {
      const thresholdValue = parseFloat(threshold);
      logger.info(`Getting high rainfall alerts with threshold ${thresholdValue}`, { deviceId });
      return await sensorLogRepository.findHighRainfall(thresholdValue, deviceId);
    } catch (error) {
      logger.error('Error getting high rainfall alerts:', error);
      throw error;
    }
  }

  async getHighWaterLevelAlerts(threshold = 90.0, deviceId = null) {
    try {
      const thresholdValue = parseFloat(threshold);
      logger.info(`Getting high water level alerts with threshold ${thresholdValue}`, { deviceId });
      return await sensorLogRepository.findHighWaterLevel(thresholdValue, deviceId);
    } catch (error) {
      logger.error('Error getting high water level alerts:', error);
      throw error;
    }
  }

  async getLatestReading(deviceId) {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      logger.info(`Getting latest reading for device ${deviceId}`);
      return await sensorLogRepository.getLatestReading(deviceId);
    } catch (error) {
      logger.error(`Error getting latest reading for device ${deviceId}:`, error);
      throw error;
    }
  }

  async updateSensorLog(id, updateData) {
    try {
      if (!id) {
        throw new Error('Sensor log ID is required');
      }

      // Prepare update data
      const data = {};
      
      if (updateData.rainfall !== undefined) {
        data.rainfall = parseFloat(updateData.rainfall);
      }
      
      if (updateData.waterLevel !== undefined) {
        data.waterLevel = parseFloat(updateData.waterLevel);
      }
      
      if (updateData.timestamp !== undefined) {
        data.timestamp = new Date(updateData.timestamp);
      }

      logger.info(`Updating sensor log ${id}`, data);
      return await sensorLogRepository.update(id, data);
    } catch (error) {
      logger.error(`Error updating sensor log ${id}:`, error);
      throw error;
    }
  }

  async deleteSensorLog(id) {
    try {
      if (!id) {
        throw new Error('Sensor log ID is required');
      }

      logger.info(`Deleting sensor log ${id}`);
      return await sensorLogRepository.delete(id);
    } catch (error) {
      logger.error(`Error deleting sensor log ${id}:`, error);
      throw error;
    }
  }

  async deleteSensorLogsByDevice(deviceId) {
    try {
      if (!deviceId) {
        throw new Error('Device ID is required');
      }

      logger.info(`Deleting all sensor logs for device ${deviceId}`);
      return await sensorLogRepository.deleteByDeviceId(deviceId);
    } catch (error) {
      logger.error(`Error deleting sensor logs for device ${deviceId}:`, error);
      throw error;
    }
  }

  async getSensorLogCount(deviceId = null) {
    try {
      logger.info('Getting sensor log count', { deviceId });
      return await sensorLogRepository.getCount(deviceId);
    } catch (error) {
      logger.error('Error getting sensor log count:', error);
      throw error;
    }
  }
}

export const sensorLogService = new SensorLogService();