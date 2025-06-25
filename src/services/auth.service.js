import { prisma } from "../prisma/prismaClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// JWT Secret - sebaiknya disimpan di environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Validasi input untuk register
const validateRegisterInput = (data) => {
    const { name, username, password, email } = data;
    const errors = [];

    if (!name || name.trim().length < 2) {
        errors.push("Nama harus minimal 2 karakter");
    }
    if (!username || username.trim().length < 3) {
        errors.push("Username harus minimal 3 karakter");
    }
    if (!password || password.length < 6) {
        errors.push("Password harus minimal 6 karakter");
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Format email tidak valid");
    }

    return errors;
};

// Validasi input untuk login
const validateLoginInput = (data) => {
    const { username, password } = data;
    const errors = [];

    if (!username || username.trim().length === 0) {
        errors.push("Username diperlukan");
    }
    if (!password || password.length === 0) {
        errors.push("Password diperlukan");
    }

    return errors;
};

export const register = async (data) => {
    const { name, username, password, email } = data;
    
    try {
        // Validasi input
        const validationErrors = validateRegisterInput(data);
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join(", "));
        }

        // Hash password sebelum disimpan
        const saltRounds = 12; // Increased for better security
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Cek apakah username atau email sudah ada
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: username.toLowerCase() },
                    { email: email.toLowerCase() }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.username === username.toLowerCase()) {
                throw new Error("Username sudah terdaftar");
            }
            if (existingUser.email === email.toLowerCase()) {
                throw new Error("Email sudah terdaftar");
            }
        }

        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                username: username.toLowerCase().trim(),
                password: hashedPassword,
                email: email.toLowerCase().trim()
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                createdAt: true
            }
        });

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return { user, token };
    } catch (error) {
        console.error('Register error:', error.message);
        throw error;
    }
};

export const login = async ({ username, password }) => {
    try {
        // Validasi input
        const validationErrors = validateLoginInput({ username, password });
        if (validationErrors.length > 0) {
            throw new Error(validationErrors.join(", "));
        }

        const user = await prisma.user.findUnique({
            where: {
                username: username.toLowerCase().trim()
            }
        });

        if (!user) {
            throw new Error("Username atau password salah");
        }

        // Verify password - FIX: Tambahkan await yang hilang
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw new Error("Username atau password salah");
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Return user data tanpa password
        const userWithoutPassword = {
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt
        };

        return { user: userWithoutPassword, token };
    } catch (error) {
        console.error('Login error:', error.message);
        throw error;
    }
};

export const verifyToken = (token) => {
    try {
        if (!token) {
            throw new Error("Token tidak tersedia");
        }
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error("Token sudah kadaluarsa");
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error("Token tidak valid");
        }
        throw new Error("Token tidak valid");
    }
};

export const refreshToken = async (oldToken) => {
    try {
        const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
        
        // Cek apakah user masih ada
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                username: true
            }
        });

        if (!user) {
            throw new Error("User tidak ditemukan");
        }

        // Generate token baru
        const newToken = jwt.sign(
            { 
                userId: user.id, 
                username: user.username 
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return newToken;
    } catch (error) {
        console.error('Refresh token error:', error.message);
        throw error;
    }
};