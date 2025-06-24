import express from 'express';
import { sensorLogController } from '../controllers/sensorLog.controller.js';
import { authenticateToken } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.get('/:deviceCode', authenticateToken, sensorLogController.getSensorLogs);
router.get('/history/:deviceCode', authenticateToken, sensorLogController.getSensorLogsByDateRange)
router.post('/', authenticateToken, sensorLogController.createSensorLog);
 