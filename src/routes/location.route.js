import express from 'express';
import { locationController } from '../controllers/location.controller.js';

export const router = express.Router();

// Static routes HARUS di atas sebelum dynamic routes
router.get('/total', locationController.getTotalLocation);
router.get('/location-status-history', locationController.getAllLocationStatusHistory);
router.get('/search', locationController.searchLocations);

// Flood management routes (static paths)
router.get('/flood/warnings', locationController.getActiveFloodWarnings);
router.get('/flood/summary', locationController.getFloodSummary);

// Basic CRUD operations
router.get('/', locationController.getAllLocations);
router.get('/without-devices', locationController.getAllLocationsWithoutDevices);
router.post('/', locationController.createLocation);

// Dynamic routes HARUS di bawah (paling akhir)
router.get('/:id', locationController.getLocationById);

// PUT routes bisa di mana saja karena method berbeda
router.put('/:id/thresholds', locationController.updateThresholds);
router.put('/:id/status', locationController.forceUpdateStatus);

// Update & Delete routes
router.put('/:id', locationController.updateLocation);
router.patch('/:id', locationController.updateLocation);
router.delete('/:id', locationController.deleteLocation);