import express from "express";
import pool from "../database/db.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const subjectRouter = express.Router();

// Get all subjects
subjectRouter.get("/", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        console.log('Subjects endpoint called by user:', req.user.username, 'with role:', req.user.role);
        
        const result = await pool.query(
            "SELECT * FROM subjects ORDER BY name ASC"
        );
        
        console.log('Subjects query result:', result.rows.length, 'subjects found');
        console.log('Subjects data:', result.rows);
        
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subjects'
        });
    }
});

// Get subject by ID
subjectRouter.get("/:id", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "SELECT * FROM subjects WHERE id = $1",
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subject'
        });
    }
});

// Create new subject
subjectRouter.post("/", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { name, code, description } = req.body;
        
        // Validate required fields
        if (!name || !code) {
            return res.status(400).json({
                success: false,
                error: 'Name and code are required'
            });
        }
        
        const result = await pool.query(
            "INSERT INTO subjects (name, code, description) VALUES ($1, $2, $3) RETURNING *",
            [name, code, description]
        );
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({
                success: false,
                error: 'Subject code already exists'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create subject'
        });
    }
});

// Update subject
subjectRouter.put("/:id", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description } = req.body;
        
        const result = await pool.query(
            "UPDATE subjects SET name = $1, code = $2, description = $3 WHERE id = $4 RETURNING *",
            [name, code, description, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update subject'
        });
    }
});

// Delete subject
subjectRouter.delete("/:id", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM subjects WHERE id = $1 RETURNING *",
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Subject deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete subject'
        });
    }
});

export default subjectRouter; 