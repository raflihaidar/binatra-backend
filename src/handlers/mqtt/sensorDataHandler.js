import logger from "../../utils/logger.js";
import { locationController } from "../../controllers/location.controller.js";
import { locationService } from "../../services/location.service.js";
import { sensorLogService } from "../../services/sensorLog.service.js";
import { createNotification } from "../../utils/notification.js";

export class SensorDataHandler {
  constructor(deviceMonitoring, notificationEmitter) {
    this.deviceMonitoring = deviceMonitoring;
    this.notificationEmitter = notificationEmitter;
  }

  async handleSensorData(topic, message, deviceCode) {
    const timestamp = new Date();

    try {
      const json = JSON.parse(message);
      const sensorDeviceCode = deviceCode || json.deviceCode || json.code;

      if (!sensorDeviceCode) {
        logger.error("Sensor data missing device code", { topic, message });
        throw new Error("Sensor data missing device code");
      }

      const waterLevel =
        json.waterlevel_cm || json.waterLevel || json.waterlevel || null;
      const rainfall = json.rainfall_mm || json.rainfall || json.rain || null;
      const deviceCalibration = json.deviceCalibration || null;
      const depth = json.depth || null;
      const voltage = json.voltage || null;

      const sensorData = {
        deviceCode: sensorDeviceCode,
        waterlevel: waterLevel,
        deviceCalibration,
        depth,
        voltage,
        waterLevel,
        rainfall,
        timestamp,
      };

      // Update device heartbeat
      try {
        await this.deviceMonitoring.handleHeartbeat(sensorDeviceCode);
      } catch (heartbeatError) {
        logger.warn(
          `Failed to update heartbeat for sensor data from ${sensorDeviceCode}:`,
          heartbeatError
        );
      }

      // Save sensor data
      const saveResult = await this.saveSensorData(sensorData);

      // Process location status if waterLevel exists
      let locationResult = null;
      if (waterLevel !== null) {
        locationResult = await this.processLocationStatus(
          sensorDeviceCode,
          waterLevel,
          rainfall || 0,
          timestamp
        );
      }

      // Emit sensor data to clients
      this.notificationEmitter.emitToAll("sensor-data", sensorData);
      this.notificationEmitter.emitToAll(
        `sensor-data-${sensorDeviceCode}`,
        sensorData
      );

      return {
        success: true,
        sensorData,
        saveResult,
        locationResult,
      };
    } catch (error) {
      logger.error("Error processing sensor data:", error);

      this.notificationEmitter.emitToAll("sensor-data-error", {
        topic,
        message,
        error: error.message,
        timestamp: timestamp.toISOString(),
      });

      throw error;
    }
  }

  async saveSensorData(sensorData) {
    const {
      deviceCode,
      deviceCalibration,
      depth,
      voltage,
      rainfall,
      waterLevel,
    } = sensorData;

    if (waterLevel === null || rainfall === null || deviceCode == null || deviceCalibration == null || depth == null || voltage == null) {
      return { saved: false, reason: "No valid sensor data to save" };
    }

    try {
      const result = await sensorLogService.createSensorLog(sensorData)

      return result;
    } catch (saveError) {
      logger.error("Error saving MQTT sensor data:", saveError);

      this.notificationEmitter.emitToAll("sensor-data-error", {
        ...sensorData,
        savedToDatabase: false,
        error: saveError.message,
      });

      throw saveError;
    }
  }

  async processLocationStatus(deviceCode, waterLevel, rainfall, timestamp) {
    try {
      const locationResult = await locationController.processSensorData(
        deviceCode,
        waterLevel,
        rainfall
      );

      if (locationResult.statusChanged) {
        await this.handleLocationStatusChange(
          locationResult,
          deviceCode,
          waterLevel,
          rainfall,
          timestamp
        );
      }

      // Update flood warnings and summary
      await this.updateFloodInformation(timestamp);

      return locationResult;
    } catch (locationError) {
      logger.error("Error processing location status:", locationError);

      this.notificationEmitter.emitToAll("location_processing_error", {
        deviceCode,
        error: locationError.message,
        timestamp: timestamp.toISOString(),
      });

      throw locationError;
    }
  }

  async handleLocationStatusChange(
    locationResult,
    deviceCode,
    waterLevel,
    rainfall,
    timestamp
  ) {
    const statusData = {
      locationId: locationResult.location.id,
      locationName: locationResult.location.name,
      previousStatus: locationResult.previousStatus,
      newStatus: locationResult.newStatus,
      waterLevel,
      rainfall,
      timestamp: timestamp.toISOString(),
      duration: locationResult.duration || 0,
    };

    // Emit location status change
    this.notificationEmitter.emitToAll("location_status_changed", statusData);
    this.notificationEmitter.emitToAll(
      `location_status_${locationResult.location.id}`,
      statusData
    );

    // Handle status history for non-AMAN status
    if (
      ["WASPADA", "SIAGA", "BAHAYA"].includes(locationResult.newStatus) &&
      locationResult.statusHistory
    ) {
      await this.emitStatusHistory(
        locationResult.statusHistory,
        deviceCode,
        timestamp
      );
    }

    // Create notifications for status changes
    if (locationResult.newStatus !== "AMAN") {
      await this.createLocationNotifications(
        locationResult,
        deviceCode,
        waterLevel,
        rainfall
      );
    }

    logger.info(
      `Location status changed: ${locationResult.location.name} from ${locationResult.previousStatus} to ${locationResult.newStatus}`
    );
  }

  async emitStatusHistory(statusHistory, deviceCode, timestamp) {
    const historyData = {
      ...statusHistory,
      deviceCode,
      timestamp: timestamp.toISOString(),
    };

    // Emit status history events
    this.notificationEmitter.emitToAll(
      "location_status_history_created",
      historyData
    );
    this.notificationEmitter.emitToAll(
      `location_history_${statusHistory.locationId}`,
      historyData
    );
    this.notificationEmitter.emitToAll(
      "flood_status_history_created",
      historyData
    );

    logger.info("Location status history emitted via socket:", {
      historyId: historyData.id,
      locationName: historyData.location.name,
      statusChange: `${historyData.previousStatus} → ${historyData.newStatus}`,
      waterLevel: historyData.waterLevel,
      deviceCode,
    });
  }

  async createLocationNotifications(
    locationResult,
    deviceCode,
    waterLevel,
    rainfall
  ) {
    const getSeverity = (status) => {
      switch (status) {
        case "BAHAYA":
          return "high";
        case "SIAGA":
          return "high";
        case "WASPADA":
          return "medium";
        default:
          return "low";
      }
    };

    const getStatusTitle = (status, waterLevel) => {
      switch (status) {
        case "BAHAYA":
          return `Banjir Ketinggian ${waterLevel}cm`;
        case "SIAGA":
          return `Siaga Ketinggian ${waterLevel}cm`;
        case "WASPADA":
          return `Waspada Ketinggian ${waterLevel}cm`;
        default:
          return `Status ${status} ${waterLevel}cm`;
      }
    };

    // Main status change notification
    const notification = createNotification("location_status_change", {
      title: getStatusTitle(locationResult.newStatus, waterLevel),
      locationId: locationResult.location.id,
      locationName: locationResult.location.name,
      deviceCode,
      location:
        locationResult.location.district || locationResult.location.name,
      timeframe: locationResult.duration
        ? `dalam ${locationResult.duration} minutes`
        : "status berubah",
      severity: getSeverity(locationResult.newStatus),
      previousStatus: locationResult.previousStatus,
      newStatus: locationResult.newStatus,
      waterLevel,
      rainfall,
      statusHistoryId: locationResult.statusHistory?.id,
    });

    this.notificationEmitter.emit(notification);

    // Special notification for new flood locations
    if (
      locationResult.previousStatus === "AMAN" &&
      ["WASPADA", "SIAGA", "BAHAYA"].includes(locationResult.newStatus)
    ) {
      const floodNotification = createNotification("new_flood_location", {
        title: `Lokasi Banjir Baru: ${locationResult.location.name}`,
        locationId: locationResult.location.id,
        locationName: locationResult.location.name,
        deviceCode,
        location:
          locationResult.location.district || locationResult.location.name,
        timeframe: `status ${locationResult.newStatus}`,
        severity: "high",
        newStatus: locationResult.newStatus,
        waterLevel,
        rainfall,
        statusHistoryId: locationResult.statusHistory?.id,
      });

      this.notificationEmitter.emit(floodNotification);
    }
  }

  async updateFloodInformation(timestamp) {
    try {
      // Update active flood warnings
      const activeWarnings = await locationService.getActiveFloodWarnings();
      this.notificationEmitter.emitToAll("flood_warnings_updated", {
        warnings: activeWarnings,
        count: activeWarnings.length,
        timestamp: timestamp.toISOString(),
      });

      // Update flood summary
      const floodSummary = await locationService.getFloodSummary();
      this.notificationEmitter.emitToAll("flood_summary_updated", {
        summary: floodSummary,
        timestamp: timestamp.toISOString(),
      });
    } catch (error) {
      logger.error("Error updating flood information:", error);
    }
  }
}
