import { login, register, verifyToken, refreshToken } from "../services/auth.service.js";
import { prisma } from "../prisma/prismaClient.js";

// Cookie options
const cookieOptions = {
  httpOnly: true,        // Cookie tidak bisa diakses via JavaScript (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only di production
  sameSite: 'strict',    // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari dalam milliseconds
  path: '/'
};

export const registerController = async (req, res) => {
  try {
    const { body } = req;
    
    // Validasi request body
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Data registrasi diperlukan',
      });
    }
    
    const { user, token } = await register(body);
    
    // Set token sebagai HTTP-only cookie
    res.cookie('authToken', token, cookieOptions);
    
    res.status(201).json({
      success: true,
      message: 'Registrasi berhasil',
      data: user,
    });
  } catch (error) {
    console.error('Register controller error:', error.message);
    
    res.status(400).json({
      success: false,
      message: 'Registrasi gagal',
      error: error.message
    });
  }
};

export const loginController = async (req, res) => {
  try {
    const { body } = req;
    
    // Validasi request body
    if (!body || !body.username || !body.password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password diperlukan',
      });
    }
    
    const { username, password } = body;
    const { user, token } = await login({ username, password });
    
    // Set token sebagai HTTP-only cookie
    res.cookie('authToken', token, cookieOptions);
    
    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: user,
    });
  } catch (error) {
    console.error('Login controller error:', error.message);
    
    // Berikan status code yang tepat berdasarkan jenis error
    const statusCode = error.message.includes('Username atau password salah') ? 401 : 400;
    
    res.status(statusCode).json({
      success: false,
      message: 'Login gagal',
      error: error.message
    });
  }
};

export const logoutController = async (req, res) => {
  try {
    // Clear cookie dengan options yang sama
    res.clearCookie('authToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    res.status(200).json({
      success: true,
      message: 'Logout berhasil'
    });
  } catch (error) {
    console.error('Logout controller error:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Logout gagal',
      error: error.message
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan. Silakan login kembali.'
      });
    }
    
    const decoded = verifyToken(token);
    
    // Ambil data user terbaru dari database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        createdAt: true
      }
    });
    
    if (!user) {
      // Clear invalid cookie
      res.clearCookie('authToken');
      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan. Silakan login kembali.'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Data user berhasil diambil',
      data: user
    });
  } catch (error) {
    console.error('Get current user error:', error.message);
    
    // Clear invalid cookie pada error token
    if (error.message.includes('Token')) {
      res.clearCookie('authToken');
    }
    
    res.status(401).json({
      success: false,
      message: 'Sesi tidak valid. Silakan login kembali.',
      error: error.message
    });
  }
};

export const refreshTokenController = async (req, res) => {
  try {
    const oldToken = req.cookies.authToken;
    
    if (!oldToken) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan'
      });
    }
    
    const newToken = await refreshToken(oldToken);
    
    // Set token baru sebagai cookie
    res.cookie('authToken', newToken, cookieOptions);
    
    res.status(200).json({
      success: true,
      message: 'Token berhasil diperbarui'
    });
  } catch (error) {
    console.error('Refresh token controller error:', error.message);
    
    // Clear invalid cookie
    res.clearCookie('authToken');
    
    res.status(401).json({
      success: false,
      message: 'Token tidak dapat diperbarui. Silakan login kembali.',
      error: error.message
    });
  }
};
