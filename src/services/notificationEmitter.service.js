// ========================================
// services/notificationEmitter.service.js
// ========================================

import logger from '../utils/logger.js';

/**
 * NotificationEmitter Service
 * Centralized service for handling all socket.io notifications and events
 */
export class NotificationEmitter {
  constructor(io) {
    this.io = io;
    
    // Track notification statistics
    this.stats = {
      totalEmitted: 0,
      byType: {},
      bySeverity: {},
      errors: 0
    };
  }

  /**
   * Main notification emit function - replaces the old emitNotification function
   * @param {Object} notification - Notification object
   */
  emit(notification) {
    try {
      // Validate notification
      if (!this.validateNotification(notification)) {
        this.stats.errors++;
        return false;
      }

      // Emit to all clients
      this.io.emit('new-notification', notification);

      // Emit to specific subscribers
      this.emitToSpecificSubscribers(notification);

      // Update statistics
      this.updateStats(notification);

      // Log the notification
      this.logNotification(notification);

      return true;

    } catch (error) {
      logger.error('Error emitting notification:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Emit to specific subscribers based on notification properties
   * This replaces the specific emit logic from the original emitNotification function
   */
  emitToSpecificSubscribers(notification) {
    // Emit to device-specific subscribers
    if (notification.deviceCode) {
      this.io.emit(`notification-device-${notification.deviceCode}`, notification);
    }

    // Emit to location-specific subscribers  
    if (notification.locationId) {
      this.io.emit(`notification-location-${notification.locationId}`, notification);
    }
  }

  /**
   * Emit event to all connected clients
   * @param {string} eventName - Event name
   * @param {Object} data - Data to emit
   */
  emitToAll(eventName, data) {
    try {
      this.io.emit(eventName, data);
      logger.debug(`Event '${eventName}' emitted to all clients`);
      return true;
    } catch (error) {
      logger.error(`Error emitting '${eventName}' to all clients:`, error);
      return false;
    }
  }

  /**
   * Emit event to specific room
   * @param {string} room - Room name
   * @param {string} eventName - Event name  
   * @param {Object} data - Data to emit
   */
  emitToRoom(room, eventName, data) {
    try {
      this.io.to(room).emit(eventName, data);
      logger.debug(`Event '${eventName}' emitted to room '${room}'`);
      return true;
    } catch (error) {
      logger.error(`Error emitting '${eventName}' to room '${room}':`, error);
      return false;
    }
  }

  /**
   * Emit device-specific events
   * @param {string} deviceCode - Device code
   * @param {string} eventName - Event name
   * @param {Object} data - Data to emit
   */
  emitToDevice(deviceCode, eventName, data) {
    const deviceRooms = [
      `device-${deviceCode}`,
      `device-status-${deviceCode}`,
      `notification-device-${deviceCode}`
    ];

    deviceRooms.forEach(room => {
      this.emitToRoom(room, eventName, data);
    });

    logger.debug(`Device event '${eventName}' emitted for device ${deviceCode}`);
  }

  /**
   * Emit location-specific events
   * @param {string} locationId - Location ID
   * @param {string} eventName - Event name
   * @param {Object} data - Data to emit
   */
  emitToLocation(locationId, eventName, data) {
    const locationRooms = [
      `location-${locationId}`,
      `location-status-${locationId}`,
      `location-history-${locationId}`,
      `notification-location-${locationId}`
    ];

    locationRooms.forEach(room => {
      this.emitToRoom(room, eventName, data);
    });

    logger.debug(`Location event '${eventName}' emitted for location ${locationId}`);
  }

  /**
   * Emit system notifications (info, warning, error)
   * @param {string} level - Notification level (info, warning, error)
   * @param {string} message - Notification message
   * @param {Object} additionalData - Additional data
   */
  emitSystemNotification(level, message, additionalData = {}) {
    const notification = {
      type: 'system_alert',
      title: `System ${level.charAt(0).toUpperCase() + level.slice(1)}`,
      message: message,
      severity: this.mapLevelToSeverity(level),
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    this.emit(notification);
  }

  /**
   * Emit error notifications
   * @param {string} source - Error source
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   */
  emitErrorNotification(source, error, context = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    
    const notification = {
      type: 'error',
      title: `Error in ${source}`,
      message: errorMessage,
      severity: 'high',
      timestamp: new Date().toISOString(),
      context
    };

    this.emit(notification);
  }

  /**
   * Validate notification object
   * @param {Object} notification - Notification to validate
   * @returns {boolean} - Is valid
   */
  validateNotification(notification) {
    if (!notification || typeof notification !== 'object') {
      logger.error('Notification must be an object');
      return false;
    }

    // Check required fields
    if (!notification.type) {
      logger.error('Notification missing required field: type');
      return false;
    }

    if (!notification.title) {
      logger.error('Notification missing required field: title');
      return false;
    }

    // Validate severity if provided
    if (notification.severity && !this.isValidSeverity(notification.severity)) {
      logger.error(`Invalid notification severity: ${notification.severity}`);
      return false;
    }

    return true;
  }

  /**
   * Check if severity is valid
   * @param {string} severity - Severity level
   * @returns {boolean} - Is valid
   */
  isValidSeverity(severity) {
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    return validSeverities.includes(severity);
  }

  /**
   * Map log level to notification severity
   * @param {string} level - Log level
   * @returns {string} - Notification severity
   */
  mapLevelToSeverity(level) {
    const severityMap = {
      'info': 'low',
      'warning': 'medium',
      'warn': 'medium', 
      'error': 'high',
      'critical': 'critical'
    };
    return severityMap[level] || 'medium';
  }

  /**
   * Update notification statistics
   * @param {Object} notification - Notification object
   */
  updateStats(notification) {
    this.stats.totalEmitted++;
    
    // Track by type
    if (notification.type) {
      this.stats.byType[notification.type] = (this.stats.byType[notification.type] || 0) + 1;
    }
    
    // Track by severity
    if (notification.severity) {
      this.stats.bySeverity[notification.severity] = (this.stats.bySeverity[notification.severity] || 0) + 1;
    }
  }

  /**
   * Log notification emission - replicates original logging behavior
   * @param {Object} notification - Notification object
   */
  logNotification(notification) {
    logger.info('Notification emitted:', {
      type: notification.type,
      title: notification.title,
      deviceCode: notification.deviceCode,
      locationId: notification.locationId,
      severity: notification.severity,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get notification statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      connectedClients: this.io.engine.clientsCount,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalEmitted: 0,
      byType: {},
      bySeverity: {},
      errors: 0
    };
    logger.info('Notification statistics reset');
  }

  /**
   * Get list of active socket rooms
   * @returns {Array} - Array of room names
   */
  getActiveRooms() {
    return Array.from(this.io.sockets.adapter.rooms.keys());
  }

  /**
   * Get number of clients in a specific room
   * @param {string} roomName - Room name
   * @returns {number} - Number of clients
   */
  getClientsInRoom(roomName) {
    const room = this.io.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  /**
   * Check if the service is healthy
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      connectedClients: this.io.engine.clientsCount,
      totalNotifications: this.stats.totalEmitted,
      errors: this.stats.errors,
      activeRooms: this.getActiveRooms().length,
      timestamp: new Date().toISOString()
    };
  }
}

// ========================================
// Factory function for easy initialization
// ========================================

/**
 * Create and initialize NotificationEmitter
 * @param {Object} io - Socket.io instance
 * @returns {NotificationEmitter} - Initialized emitter
 */
export function createNotificationEmitter(io) {
  const emitter = new NotificationEmitter(io);
  
  logger.info('NotificationEmitter initialized', {
    connectedClients: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
  
  return emitter;
}


export default NotificationEmitter;