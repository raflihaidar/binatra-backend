import { sensorLogRepository } from '../repositories/sensorLog.repository.js';
import logger from '../utils/logger.js';

class SensorLogService {
  async createSensorLog(data) {
    try {
      // Validasi input
      if (!data.deviceCode) {
        throw new Error('Device ID is required');
      }

      // Validasi bahwa setidaknya salah satu sensor data ada
      if (data.rainfall === undefined && data.waterLevel === undefined) {
        throw new Error('At least one of rainfall or waterLevel must be provided');
      }

      // Prepare data
      const sensorData = {
        deviceCode: data.deviceCode,
        rainfall: data.rainfall !== undefined ? parseFloat(data.rainfall) : null,
        waterLevel: data.waterLevel !== undefined ? parseFloat(data.waterLevel) : null,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
      };

      logger.info(`Creating sensor log for device ${data.deviceCode}`, sensorData);
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
        if (!log.deviceCode) {
          throw new Error('Device ID is required for all logs');
        }

        return {
          deviceCode: log.deviceCode,
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

  async getSensorLogsByDevice(deviceCode) {
    try {
      if (!deviceCode) {
        throw new Error('Device Code is required');
      }

      logger.info(`Getting sensor logs for device ${deviceCode}`);
      return await sensorLogRepository.findBydeviceCode(deviceCode);
    } catch (error) {
      logger.error(`Error getting sensor logs for device ${deviceCode}:`, error);
      throw error;
    }
  }

  async getLatestSensorLogs(deviceCode, limit = 10) {
    try {
      if (!deviceCode) {
        throw new Error('Device ID is required');
      }

      logger.info(`Getting latest ${limit} sensor logs for device ${deviceCode}`);
      return await sensorLogRepository.findLatestBydeviceCode(deviceCode, parseInt(limit));
    } catch (error) {
      logger.error(`Error getting latest sensor logs for device ${deviceCode}:`, error);
      throw error;
    }
  }

  async getSensorLogsByDateRange(deviceCode, startDate, endDate) {
    try {
      if (!deviceCode || !startDate || !endDate) {
        throw new Error('Device ID, start date, and end date are required');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new Error('Start date cannot be later than end date');
      }

      logger.info(`Getting sensor logs for device ${deviceCode} from ${startDate} to ${endDate}`);
      return await sensorLogRepository.findByDateRange(deviceCode, start, end);
    } catch (error) {
      logger.error(`Error getting sensor logs by date range for device ${deviceCode}:`, error);
      throw error;
    }
  }

  async getSensorLogStatistics(deviceCode, startDate, endDate) {
    try {
      if (!deviceCode || !startDate || !endDate) {
        throw new Error('Device ID, start date, and end date are required');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new Error('Start date cannot be later than end date');
      }

      logger.info(`Getting statistics for device ${deviceCode} from ${startDate} to ${endDate}`);
      return await sensorLogRepository.getStatistics(deviceCode, start, end);
    } catch (error) {
      logger.error(`Error getting statistics for device ${deviceCode}:`, error);
      throw error;
    }
  }

  async getLatestReading(deviceCode) {
    try {
      if (!deviceCode) {
        throw new Error('Device ID is required');
      }

      logger.info(`Getting latest reading for device ${deviceCode}`);
      return await sensorLogRepository.getLatestReading(deviceCode);
    } catch (error) {
      logger.error(`Error getting latest reading for device ${deviceCode}:`, error);
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

  async deleteSensorLogsByDevice(deviceCode) {
    try {
      if (!deviceCode) {
        throw new Error('Device ID is required');
      }

      logger.info(`Deleting all sensor logs for device ${deviceCode}`);
      return await sensorLogRepository.deleteBydeviceCode(deviceCode);
    } catch (error) {
      logger.error(`Error deleting sensor logs for device ${deviceCode}:`, error);
      throw error;
    }
  }
}

export const sensorLogService = new SensorLogService();