import express from 'express';
import { predictionController } from '../controllers/prediction.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

export const router = express.Router();

router.post('/', authenticateToken, predictionController.getPrediction);
 