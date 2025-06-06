import express from 'express';
import { sensorLogController } from '../controllers/sensorLog.controller.js';

export const router = express.Router();

router.post('/', sensorLogController.createSensorLog);
router.get('/:deviceId', sensorLogController.getSensorLogs);
