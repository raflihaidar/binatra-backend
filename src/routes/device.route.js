import express from 'express';
import { deviceController } from '../controllers/device.controller.js';

export const router = express.Router();

router.get('/', deviceController.getAllDevices);

router.post('/', deviceController.createDevice);
