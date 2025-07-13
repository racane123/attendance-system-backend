import express from "express";
import pool from "../database/db.js";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const accountRouter = express.Router();

// Get user profile (protected route)
accountRouter.get("/profile", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            "SELECT id, username, email, role, created_at FROM users WHERE id = $1",
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user profile'
        });
    }
});

// Register new user
accountRouter.post('/register', async (req, res) => {
    try {
        const { username, email, password, role = 'viewer' } = req.body;
        
        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username, email, and password are required'
            });
        }
        
        // Check if user already exists
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE username = $1 OR email = $2",
            [username, email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Username or email already exists'
            });
        }
        
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await pool.query(
            "INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at",
            [username, email, hashedPassword, role]
        );
        
        // Generate JWT token
        const token = jwt.sign(
            { id: result.rows[0].id, username, role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        res.status(201).json({
            success: true,
            data: {
                user: result.rows[0],
                token
            }
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register user'
        });
    }
});

// Login user
accountRouter.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate required fields
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }
        
        // Find user
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        const user = result.rows[0];
        
        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        
        // Return user data (without password)
        const userData = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            created_at: user.created_at
        };
        
        res.status(200).json({
            success: true,
            data: {
                user: userData,
                token
            }
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to log in'
        });
    }
});

// Change password (protected route)
accountRouter.put("/change-password", authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }
        
        // Get current user
        const userResult = await pool.query(
            "SELECT password FROM users WHERE id = $1",
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
        
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }
        
        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // Update password
        await pool.query(
            "UPDATE users SET password = $1 WHERE id = $2",
            [hashedPassword, userId]
        );
        
        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});

export default accountRouter;
