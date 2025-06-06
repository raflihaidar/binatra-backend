import { login, register, verifyToken } from "../services/auth.service.js";

// Cookie options
const cookieOptions = {
  httpOnly: true,        // Cookie tidak bisa diakses via JavaScript (XSS protection)
  secure: process.env.NODE_ENV === 'production', // HTTPS only di production
  sameSite: 'strict',    // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari dalam milliseconds
  path: '/'
};

export const registerController = async (req, res) => {
  const { body } = req;
  
  try {
    const { user, token } = await register(body);
    
    // Set token sebagai HTTP-only cookie
    res.cookie('authToken', token, cookieOptions);
    
    res.status(201).json({
      message: 'Registrasi berhasil',
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      message: 'Registrasi gagal',
      serverMessage: error.message
    });
  }
};

export const loginController = async (req, res) => {
  const { body } = req;
  
  try {
    const { username, password } = body;
    const { user, token } = await login({ username, password });
    
    // Set token sebagai HTTP-only cookie
    res.cookie('authToken', token, cookieOptions);
    
    res.status(200).json({
      message: 'Login berhasil',
      data: user,
    });
  } catch (error) {
    res.status(401).json({
      message: 'Login gagal',
      serverMessage: error.message
    });
  }
};

export const logoutController = async (req, res) => {
  try {
    // Clear cookie
    res.clearCookie('authToken');
    
    res.status(200).json({
      message: 'Logout berhasil'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Logout gagal',
      serverMessage: error.message
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.status(401).json({
        message: 'Token tidak ditemukan'
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
      return res.status(401).json({
        message: 'User tidak ditemukan'
      });
    }
    
    res.status(200).json({
      message: 'Data user berhasil diambil',
      data: user
    });
  } catch (error) {
    res.status(401).json({
      message: 'Token tidak valid',
      serverMessage: error.message
    });
  }
};