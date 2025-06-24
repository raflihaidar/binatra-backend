import express from 'express';
import { locationController } from '../controllers/location.controller.js';
import { authenticateToken } from "../middleware/auth.middleware.js";

export const router = express.Router();

// Static routes HARUS di atas sebelum dynamic routes
router.get('/total', authenticateToken, locationController.getTotalLocation);
router.get('/location-status-history', authenticateToken, locationController.getAllLocationStatusHistory);
router.get('/search', authenticateToken, locationController.searchLocations);

// Flood management routes (static paths)
router.get('/flood/warnings', authenticateToken, locationController.getActiveFloodWarnings);
router.get('/flood/summary', authenticateToken, locationController.getFloodSummary);

// Basic CRUD operations
router.get('/', authenticateToken, locationController.getAllLocations);
router.get('/without-devices', authenticateToken, locationController.getAllLocationsWithoutDevices);
router.post('/', authenticateToken, locationController.createLocation);

// Dynamic routes HARUS di bawah (paling akhir)
router.get('/:id', authenticateToken, locationController.getLocationById);

// PUT routes bisa di mana saja karena method berbeda
router.put('/:id/thresholds', authenticateToken, locationController.updateThresholds);
router.put('/:id/status', authenticateToken, locationController.forceUpdateStatus);

// Update & Delete routes
router.put('/:id', authenticateToken, locationController.updateLocation);
router.patch('/:id', authenticateToken, locationController.updateLocation);
router.delete('/:id', authenticateToken, locationController.deleteLocation);