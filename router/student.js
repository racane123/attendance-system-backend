import express from "express";
import pool from "../database/db.js";
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, requireRole } from "../middleware/auth.js";

const studentRouter = express.Router();

// Get all students
studentRouter.get("/", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM students ORDER BY created_at DESC"
        );
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch students'
        });
    }
});

// Get student by ID
studentRouter.get("/:id", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "SELECT * FROM students WHERE id = $1",
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student'
        });
    }
});

// Create new student
studentRouter.post("/", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { student_id, first_name, middle_name, last_name, email, section } = req.body;
        
        // Validate required fields
        if (!student_id || !first_name || !last_name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Student ID, first name, last name, and email are required'
            });
        }
        
        // Generate unique QR code
        const qr_code = uuidv4();
        
        const result = await pool.query(
            "INSERT INTO students (student_id, first_name, middle_name, last_name, email, qr_code, section) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [student_id, first_name, middle_name || null, last_name, email, qr_code, section || 'A']
        );
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating student:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({
                success: false,
                error: 'Student ID or email already exists'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to create student'
        });
    }
});

// Update student
studentRouter.put("/:id", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { id } = req.params;
        const { student_id, first_name, middle_name, last_name, email, section } = req.body;
        
        const result = await pool.query(
            "UPDATE students SET student_id = $1, first_name = $2, middle_name = $3, last_name = $4, email = $5, section = $6 WHERE id = $7 RETURNING *",
            [student_id, first_name, middle_name || null, last_name, email, section || 'A', id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update student'
        });
    }
});

// Delete student
studentRouter.delete("/:id", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM students WHERE id = $1 RETURNING *",
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Student deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete student'
        });
    }
});

// Get student by QR code
studentRouter.get("/by-qr/:qr_code", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { qr_code } = req.params;
        const result = await pool.query(
            "SELECT * FROM students WHERE qr_code = $1",
            [qr_code]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }
        
        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching student by QR code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student'
        });
    }
});

// Get students by section
studentRouter.get("/by-section/:section", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const { section } = req.params;
        const result = await pool.query(
            "SELECT * FROM students WHERE section = $1 ORDER BY last_name, first_name",
            [section]
        );
        
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching students by section:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch students by section'
        });
    }
});

// Get all sections
studentRouter.get("/sections/all", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT DISTINCT section FROM students ORDER BY section"
        );
        
        const sections = result.rows.map(row => row.section);
        
        res.status(200).json({
            success: true,
            data: sections
        });
    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sections'
        });
    }
});

export default studentRouter; 