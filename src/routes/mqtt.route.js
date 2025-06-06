import express from 'express';
import { mqttController } from '../controllers/mqtt.controller.js';

const router = express.Router();

router.post('/start', mqttController.startMqttClient);
router.post('/stop', mqttController.stopMqttClient);
router.post('/publish', mqttController.publishMessage);

export default router;