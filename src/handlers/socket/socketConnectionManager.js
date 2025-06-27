import logger from '../../utils/logger.js';
import { locationService } from '../../services/location.service.js';

export class SocketConnectionManager {
  constructor(io, deviceMonitoring, notificationEmitter) {
    this.io = io;
    this.deviceMonitoring = deviceMonitoring;
    this.notificationEmitter = notificationEmitter;
    
    // Track connection statistics
    this.stats = {
      totalConnections: 0,
      currentConnections: 0,
      peakConnections: 0
    };
  }

  /**
   * Handle new socket connection
   * @param {Object} socket - Socket.io socket instance
   */
  async handleConnection(socket) {
    // Update connection stats
    this.stats.totalConnections++;
    this.stats.currentConnections++;
    this.stats.peakConnections = Math.max(this.stats.peakConnections, this.stats.currentConnections);

    console.log('Client connected:', socket.id);
    logger.info('New socket connection', {
      socketId: socket.id,
      currentConnections: this.stats.currentConnections,
      totalConnections: this.stats.totalConnections
    });

    // Send initial data to new client
    await this.sendInitialData(socket);

    // Setup event handlers
    this.setupDeviceHandlers(socket);
    this.setupLocationHandlers(socket);
    this.setupNotificationHandlers(socket);
    this.setupFloodHandlers(socket);
    this.setupSystemHandlers(socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Send initial data to newly connected client
   * @param {Object} socket - Socket instance
   */
  async sendInitialData(socket) {
    try {
      // Send device status summary
      const deviceSummary = await this.deviceMonitoring.getStatusSummary();
      socket.emit('device_status_summary', deviceSummary);

      // Send flood summary
      const floodSummary = await locationService.getFloodSummary();
      socket.emit('flood_summary', floodSummary);

      // Send active flood warnings
      const activeWarnings = await locationService.getActiveFloodWarnings();
      socket.emit('flood_warnings_updated', {
        warnings: activeWarnings,
        count: activeWarnings.length
      });

      // Send recent location status history
      const locationHistory = await locationService.getAllLocationStatusHistory({
        page: 1,
        limit: 20,
        sortBy: 'changedAt',
        sortOrder: 'desc'
      });

      if (locationHistory.success) {
        socket.emit('location_status_history_initial', {
          histories: locationHistory.data,
          pagination: locationHistory.pagination,
          timestamp: new Date().toISOString()
        });
      }

      logger.debug('Initial data sent to new client', { socketId: socket.id });

    } catch (error) {
      logger.error('Error sending initial data to new client:', error);
      socket.emit('error', {
        message: 'Failed to load initial data',
        error: error.message
      });
    }
  }

  /**
   * Setup device-related event handlers
   * @param {Object} socket - Socket instance
   */
  setupDeviceHandlers(socket) {
    // Device status subscriptions
    socket.on('subscribe-device-status', (deviceCode) => {
      socket.join(`device-status-${deviceCode}`);
      console.log(`Client ${socket.id} subscribed to device status ${deviceCode}`);
      
      logger.debug('Device status subscription', {
        socketId: socket.id,
        deviceCode
      });
    });

    socket.on('unsubscribe-device-status', (deviceCode) => {
      socket.leave(`device-status-${deviceCode}`);
      console.log(`Client ${socket.id} unsubscribed from device status ${deviceCode}`);
    });

    // General device subscriptions
    socket.on('subscribe-device', (deviceId) => {
      socket.join(`device-${deviceId}`);
      console.log(`Client ${socket.id} subscribed to device ${deviceId}`);
    });

    socket.on('unsubscribe-device', (deviceId) => {
      socket.leave(`device-${deviceId}`);
      console.log(`Client ${socket.id} unsubscribed from device ${deviceId}`);
    });

    // Device notifications
    socket.on('subscribe-device-notifications', (deviceCode) => {
      socket.join(`notification-device-${deviceCode}`);
      console.log(`Client ${socket.id} subscribed to device notifications for ${deviceCode}`);
    });
  }

  /**
   * Setup location-related event handlers
   * @param {Object} socket - Socket instance
   */
  setupLocationHandlers(socket) {
    // Location subscriptions
    socket.on('subscribe-location', (locationId) => {
      socket.join(`location-${locationId}`);
      console.log(`Client ${socket.id} subscribed to location ${locationId}`);
    });

    socket.on('unsubscribe-location', (locationId) => {
      socket.leave(`location-${locationId}`);
      console.log(`Client ${socket.id} unsubscribed from location ${locationId}`);
    });

    // Location history subscriptions
    socket.on('subscribe-location-history', (locationId) => {
      socket.join(`location-history-${locationId}`);
      console.log(`Client ${socket.id} subscribed to location history ${locationId}`);
    });

    socket.on('unsubscribe-location-history', (locationId) => {
      socket.leave(`location-history-${locationId}`);
      console.log(`Client ${socket.id} unsubscribed from location history ${locationId}`);
    });

    // Location notifications
    socket.on('subscribe-location-notifications', (locationId) => {
      socket.join(`notification-location-${locationId}`);
      console.log(`Client ${socket.id} subscribed to location notifications for ${locationId}`);
    });

    // Get location details
    socket.on('get-location-details', async (locationId) => {
      try {
        const location = await locationService.getLocationById(locationId);
        socket.emit('location-details', location);
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to get location details',
          error: error.message
        });
      }
    });

    // Get location history
    socket.on('get-location-history', async (params) => {
      try {
        const { locationId, page = 1, limit = 10 } = params || {};
        
        let result;
        if (locationId) {
          result = await locationService.getAllLocationStatusHistory({
            locationId,
            page,
            limit,
            sortBy: 'changedAt',
            sortOrder: 'desc'
          });
        } else {
          result = await locationService.getAllLocationStatusHistory({
            page,
            limit,
            sortBy: 'changedAt',
            sortOrder: 'desc'
          });
        }

        socket.emit('location-history-response', {
          success: result.success,
          data: result.data,
          pagination: result.pagination,
          locationId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to get location status history',
          error: error.message
        });
      }
    });
  }

  /**
   * Setup notification-related event handlers
   * @param {Object} socket - Socket instance
   */
  setupNotificationHandlers(socket) {
    // General notification subscriptions
    socket.on('subscribe-notifications', () => {
      socket.join('notifications');
      console.log(`Client ${socket.id} subscribed to notifications`);
    });

    socket.on('unsubscribe-notifications', () => {
      socket.leave('notifications');
      console.log(`Client ${socket.id} unsubscribed from notifications`);
    });
  }

  /**
   * Setup flood-related event handlers
   * @param {Object} socket - Socket instance
   */
  setupFloodHandlers(socket) {
    // Flood history subscriptions
    socket.on('subscribe-flood-history', () => {
      socket.join('flood-history');
      console.log(`Client ${socket.id} subscribed to flood status history`);
    });

    socket.on('unsubscribe-flood-history', () => {
      socket.leave('flood-history');
      console.log(`Client ${socket.id} unsubscribed from flood status history`);
    });

    // Get flood status
    socket.on('get-flood-status', async () => {
      try {
        const [summary, warnings] = await Promise.all([
          locationService.getFloodSummary(),
          locationService.getActiveFloodWarnings()
        ]);
        
        socket.emit('flood-status-response', {
          summary,
          warnings,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to get flood status',
          error: error.message
        });
      }
    });

    // Get flood history with filters
    socket.on('get-flood-history', async (params) => {
      try {
        const {
          page = 1,
          limit = 20,
          status = null,
          startDate = null,
          endDate = null
        } = params || {};

        const result = await locationService.getAllLocationStatusHistory({
          page,
          limit,
          status,
          startDate,
          endDate,
          sortBy: 'changedAt',
          sortOrder: 'desc'
        });

        socket.emit('flood-history-response', {
          success: result.success,
          data: result.data,
          pagination: result.pagination,
          filters: { status, startDate, endDate },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to get flood status history',
          error: error.message
        });
      }
    });
  }

  /**
   * Setup system-related event handlers
   * @param {Object} socket - Socket instance
   */
  setupSystemHandlers(socket) {
    // Get system stats
    socket.on('get-system-stats', () => {
      const stats = {
        connections: this.stats,
        notifications: this.notificationEmitter.getStats(),
        activeRooms: this.notificationEmitter.getActiveRooms(),
        timestamp: new Date().toISOString()
      };
      
      socket.emit('system-stats', stats);
    });

    // Ping/pong for connection testing
    socket.on('ping', (data) => {
      socket.emit('pong', {
        ...data,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket instance
   */
  handleDisconnection(socket) {
    this.stats.currentConnections--;
    
    console.log('Client disconnected:', socket.id);
    logger.info('Socket disconnected', {
      socketId: socket.id,
      currentConnections: this.stats.currentConnections
    });
  }

  /**
   * Get connection statistics
   * @returns {Object} Connection stats
   */
  getStats() {
    return {
      ...this.stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Broadcast message to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Data to broadcast
   */
  broadcast(event, data) {
    this.io.emit(event, data);
    logger.debug('Message broadcasted to all clients', { event });
  }

  /**
   * Send message to specific room
   * @param {string} room - Room name
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  sendToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
    logger.debug('Message sent to room', { room, event });
  }

  /**
   * Get list of clients in a room
   * @param {string} room - Room name
   * @returns {Set} Set of socket IDs
   */
  getClientsInRoom(room) {
    return this.io.sockets.adapter.rooms.get(room) || new Set();
  }

  /**
   * Force disconnect a specific socket
   * @param {string} socketId - Socket ID to disconnect
   */
  disconnectSocket(socketId) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect();
      logger.info('Socket force disconnected', { socketId });
    }
  }

  /**
   * Get health status of socket manager
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      connections: this.stats,
      activeRooms: this.notificationEmitter.getActiveRooms().length,
      timestamp: new Date().toISOString()
    };
  }
}