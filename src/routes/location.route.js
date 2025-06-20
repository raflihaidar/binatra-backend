import express from 'express';
import { locationController } from '../controllers/location.controller.js';

export const router = express.Router();

// Basic CRUD operations
router.get('/', locationController.getAllLocations);
router.get('/total', locationController.getTotalLocation);
router.get('/location-status-history', locationController.getAllLocationStatusHistory);
router.post('/', locationController.createLocation);
router.get('/search', locationController.searchLocations);
router.get('/:id', locationController.getLocationById);

// Flood management routes
router.get('/flood/warnings', locationController.getActiveFloodWarnings);
router.get('/flood/summary', locationController.getFloodSummary);

// Threshold management
router.put('/:id/thresholds', locationController.updateThresholds);

// Manual status update (for testing)
router.put('/:id/status', locationController.forceUpdateStatus);