import express from 'express';
import { deviceController } from '../controllers/device.controller.js';

export const router = express.Router();

router.get('/', deviceController.getAllDevices);
router.get('/status', deviceController.getStatusSummary);
router.get('/:code', deviceController.findDeviceByCode);
router.post('/', deviceController.createDevice);


