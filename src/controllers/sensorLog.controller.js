import { sensorLogService } from '../services/sensorLog.service.js';
import logger from '../utils/logger.js';

class SensorLogController {
  getSensorLogs = async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      const sensorLogs = await sensorLogService.getSensorLogsByDevice(deviceId);
      return res.status(200).json({
        message: "Sensor logs retrieved successfully",
        data: sensorLogs,
        total: sensorLogs.length
      });
    } catch (error) {
      logger.error('Error getting sensor logs:', error);
      return res.status(500).json({ 
        message: 'Failed to get sensor logs',
        error: error.message 
      });
    }
  }

  createSensorLog = async (req, res) => {
    try {
      // Log untuk debugging
      console.log('Request body:', req.body);
      
      const sensorLog = await sensorLogService.createSensorLog(req.body);

      res.status(201).json({
        message: "Sensor log created successfully",
        data: sensorLog
      });
    } catch (error) {
      logger.error('Create sensor log error:', error);
      res.status(400).json({
        message: "Failed to create sensor log",
        error: error.message
      });
    }
  }

  getLatestSensorLogs = async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { limit = 10 } = req.query;

      const sensorLogs = await sensorLogService.getLatestSensorLogs(deviceId, limit);

      res.status(200).json({
        message: "Latest sensor logs retrieved successfully",
        data: sensorLogs,
        pagination: {
          total: sensorLogs.length,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      logger.error('Get latest sensor logs error:', error);
      res.status(500).json({
        message: "Failed to retrieve sensor logs",
        error: error.message
      });
    }
  }

  getSensorLogsByDateRange = async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;

      const sensorLogs = await sensorLogService.getSensorLogsByDateRange(
        deviceId,
        startDate,
        endDate
      );

      res.status(200).json({
        message: "Sensor logs by date range retrieved successfully",
        data: sensorLogs,
        total: sensorLogs.length,
        dateRange: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      logger.error('Get sensor logs by date range error:', error);
      res.status(500).json({
        message: "Failed to retrieve sensor logs",
        error: error.message
      });
    }
  }

  getSensorLogStatistics = async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;

      const statistics = await sensorLogService.getSensorLogStatistics(
        deviceId,
        startDate,
        endDate
      );

      res.status(200).json({
        message: "Statistics retrieved successfully",
        data: statistics,
        dateRange: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      logger.error('Get statistics error:', error);
      res.status(500).json({
        message: "Failed to retrieve statistics",
        error: error.message
      });
    }
  }

  getHourlyAverage = async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { date } = req.query;

      const hourlyData = await sensorLogService.getHourlyAverage(deviceId, date);

      res.status(200).json({
        message: "Hourly average retrieved successfully",
        data: hourlyData,
        date
      });
    } catch (error) {
      logger.error('Get hourly average error:', error);
      res.status(500).json({
        message: "Failed to retrieve hourly average",
        error: error.message
      });
    }
  }

  getDailyAverage = async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { month, year } = req.query;

      const dailyData = await sensorLogService.getDailyAverage(deviceId, month, year);

      res.status(200).json({
        message: "Daily average retrieved successfully",
        data: dailyData,
        period: { month: parseInt(month), year: parseInt(year) }
      });
    } catch (error) {
      logger.error('Get daily average error:', error);
      res.status(500).json({
        message: "Failed to retrieve daily average",
        error: error.message
      });
    }
  }

  getHighRainfallAlerts = async (req, res) => {
    try {
      const { threshold = 5.0, deviceId } = req.query;

      const alerts = await sensorLogService.getHighRainfallAlerts(threshold, deviceId);

      res.status(200).json({
        message: "High rainfall alerts retrieved successfully",
        data: alerts,
        threshold: parseFloat(threshold),
        total: alerts.length
      });
    } catch (error) {
      logger.error('Get high rainfall alerts error:', error);
      res.status(500).json({
        message: "Failed to retrieve high rainfall alerts",
        error: error.message
      });
    }
  }

  getHighWaterLevelAlerts = async (req, res) => {
    try {
      const { threshold = 90.0, deviceId } = req.query;

      const alerts = await sensorLogService.getHighWaterLevelAlerts(threshold, deviceId);

      res.status(200).json({
        message: "High water level alerts retrieved successfully",
        data: alerts,
        threshold: parseFloat(threshold),
        total: alerts.length
      });
    } catch (error) {
      logger.error('Get high water level alerts error:', error);
      res.status(500).json({
        message: "Failed to retrieve high water level alerts",
        error: error.message
      });
    }
  }

  getLatestReading = async (req, res) => {
    try {
      const { deviceId } = req.params;

      const latestReading = await sensorLogService.getLatestReading(deviceId);

      if (!latestReading) {
        return res.status(404).json({
          message: "No sensor readings found for this device"
        });
      }

      res.status(200).json({
        message: "Latest reading retrieved successfully",
        data: latestReading
      });
    } catch (error) {
      logger.error('Get latest reading error:', error);
      res.status(500).json({
        message: "Failed to retrieve latest reading",
        error: error.message
      });
    }
  }

  createMultipleSensorLogs = async (req, res) => {
    try {
      const { logs } = req.body;

      const result = await sensorLogService.createMultipleSensorLogs(logs);

      res.status(201).json({
        message: "Multiple sensor logs created successfully",
        data: {
          count: result.count,
          created: result.count
        }
      });
    } catch (error) {
      logger.error('Create multiple sensor logs error:', error);
      res.status(500).json({
        message: "Failed to create multiple sensor logs",
        error: error.message
      });
    }
  }

  updateSensorLog = async (req, res) => {
    try {
      const { id } = req.params;

      const updatedSensorLog = await sensorLogService.updateSensorLog(id, req.body);

      res.status(200).json({
        message: "Sensor log updated successfully",
        data: updatedSensorLog
      });
    } catch (error) {
      logger.error('Update sensor log error:', error);
      res.status(500).json({
        message: "Failed to update sensor log",
        error: error.message
      });
    }
  }

  deleteSensorLog = async (req, res) => {
    try {
      const { id } = req.params;

      await sensorLogService.deleteSensorLog(id);

      res.status(200).json({
        message: "Sensor log deleted successfully"
      });
    } catch (error) {
      logger.error('Delete sensor log error:', error);
      res.status(500).json({
        message: "Failed to delete sensor log",
        error: error.message
      });
    }
  }

  deleteSensorLogsByDevice = async (req, res) => {
    try {
      const { deviceId } = req.params;

      const result = await sensorLogService.deleteSensorLogsByDevice(deviceId);

      res.status(200).json({
        message: "All sensor logs for device deleted successfully",
        deletedCount: result.count
      });
    } catch (error) {
      logger.error('Delete sensor logs by device error:', error);
      res.status(500).json({
        message: "Failed to delete sensor logs",
        error: error.message
      });
    }
  }

  getSensorLogCount = async (req, res) => {
    try {
      const { deviceId } = req.query;

      const count = await sensorLogService.getSensorLogCount(deviceId);

      res.status(200).json({
        message: "Sensor log count retrieved successfully",
        data: {
          count,
          deviceId: deviceId || 'all'
        }
      });
    } catch (error) {
      logger.error('Get sensor log count error:', error);
      res.status(500).json({
        message: "Failed to get sensor log count",
        error: error.message
      });
    }
  }
}

export const sensorLogController = new SensorLogController();