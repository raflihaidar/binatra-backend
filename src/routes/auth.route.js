import express from 'express';
import cookieParser from 'cookie-parser';
import { 
  registerController, 
  loginController, 
  logoutController, 
  getCurrentUser 
} from '../controllers/auth.controller.js';
import { 
  authenticateToken, 
  redirectIfAuthenticated 
} from '../middleware/auth.middleware.js';

export const router = express.Router();

// Middleware untuk parsing cookies
router.use(cookieParser());

router.get('/me', authenticateToken, getCurrentUser);


// Public routes
router.post('/register', redirectIfAuthenticated, registerController);
router.post('/login', redirectIfAuthenticated, loginController);

// Protected routes
router.post('/logout', authenticateToken, logoutController);
