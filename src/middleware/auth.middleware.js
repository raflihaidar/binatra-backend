import { verifyToken } from "../services/auth.service.js";
import { prisma } from "../prisma/prismaClient.js";

export const authenticateToken = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({
        message: 'Akses ditolak. Token tidak ditemukan.'
      });
    }
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Cek apakah user masih ada di database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true
      }
    });
    
    if (!user) {
      return res.status(401).json({
        message: 'User tidak ditemukan'
      });
    }
    
    // Tambahkan user data ke request
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      message: 'Token tidak valid',
      serverMessage: error.message
    });
  }
};

// Middleware untuk route yang tidak memerlukan autentikasi
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true
        }
      });
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Jika token tidak valid, lanjutkan tanpa user
    next();
  }
};

// Middleware untuk redirect jika sudah login
export const redirectIfAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;
    
    if (token) {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
      
      if (user) {
        return res.status(400).json({
          message: 'Anda sudah login'
        });
      }
    }
    
    next();
  } catch (error) {
    // Jika token tidak valid, lanjutkan
    next();
  }
};