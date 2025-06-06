import { prisma } from "../prisma/prismaClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// JWT Secret - sebaiknya disimpan di environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

export const register = async (data) => {
    const { name, username, password, email } = data;
    
    try {
        // Hash password sebelum disimpan
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Cek apakah username atau email sudah ada
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingUser) {
            throw new Error("Username atau email sudah terdaftar");
        }

        const user = await prisma.user.create({
            data: {
                name,
                username,
                password: hashedPassword,
                email
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
        console.log(error);
        throw error;
    }
};

export const login = async ({ username, password }) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                username
            }
        });

        if (!user) {
            throw new Error("Username atau password salah");
        }

        // Verify password
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
        throw error;
    }
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error("Token tidak valid");
    }
};