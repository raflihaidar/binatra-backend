import express from 'express';
import { sensorLogController } from '../controllers/sensorLog.controller.js';

export const router = express.Router();

router.get('/:deviceCode', sensorLogController.getSensorLogs);
router.get('/history/:deviceCode', sensorLogController.getSensorLogsByDateRange)
router.post('/', sensorLogController.createSensorLog);
 