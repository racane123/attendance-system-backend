import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all enrollments
router.get('/', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                ss.id,
                s.id as student_id,
                s.first_name || ' ' || COALESCE(s.middle_name || ' ', '') || s.last_name as student_name,
                s.student_id as student_number,
                s.section,
                sub.id as subject_id,
                sub.name as subject_name,
                sub.code as subject_code,
                ss.enrollment_date,
                ss.is_active,
                ss.created_at
            FROM student_subjects ss
            JOIN students s ON ss.student_id = s.id
            JOIN subjects sub ON ss.subject_id = sub.id
            ORDER BY s.last_name, s.first_name, sub.name
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch enrollments'
        });
    }
});

// Get enrollments by student
router.get('/student/:studentId', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { studentId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                ss.id,
                sub.id as subject_id,
                sub.name as subject_name,
                sub.code as subject_code,
                ss.enrollment_date,
                ss.is_active
            FROM student_subjects ss
            JOIN subjects sub ON ss.subject_id = sub.id
            WHERE ss.student_id = $1
            ORDER BY sub.name
        `, [studentId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching student enrollments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch student enrollments'
        });
    }
});

// Get enrollments by subject
router.get('/subject/:subjectId', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { subjectId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                ss.id,
                s.id as student_id,
                s.first_name || ' ' || COALESCE(s.middle_name || ' ', '') || s.last_name as student_name,
                s.student_id as student_number,
                s.section,
                ss.enrollment_date,
                ss.is_active
            FROM student_subjects ss
            JOIN students s ON ss.student_id = s.id
            WHERE ss.subject_id = $1
            ORDER BY s.last_name, s.first_name
        `, [subjectId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching subject enrollments:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subject enrollments'
        });
    }
});

// Enroll a student in a subject
router.post('/', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { student_id, subject_id } = req.body;

        if (!student_id || !subject_id) {
            return res.status(400).json({
                success: false,
                error: 'Student ID and Subject ID are required'
            });
        }

        // Check if enrollment already exists
        const existingEnrollment = await pool.query(
            'SELECT id FROM student_subjects WHERE student_id = $1 AND subject_id = $2',
            [student_id, subject_id]
        );

        if (existingEnrollment.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Student is already enrolled in this subject'
            });
        }

        // Create new enrollment
        const result = await pool.query(
            'INSERT INTO student_subjects (student_id, subject_id) VALUES ($1, $2) RETURNING *',
            [student_id, subject_id]
        );

        res.status(201).json({
            success: true,
            message: 'Student enrolled successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error enrolling student:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to enroll student'
        });
    }
});

// Update enrollment status (activate/deactivate)
router.patch('/:enrollmentId', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'is_active must be a boolean value'
            });
        }

        const result = await pool.query(
            'UPDATE student_subjects SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
            [is_active, enrollmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Enrollment not found'
            });
        }

        res.json({
            success: true,
            message: `Enrollment ${is_active ? 'activated' : 'deactivated'} successfully`,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating enrollment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update enrollment'
        });
    }
});

// Delete enrollment
router.delete('/:enrollmentId', authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { enrollmentId } = req.params;

        const result = await pool.query(
            'DELETE FROM student_subjects WHERE id = $1 RETURNING *',
            [enrollmentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Enrollment not found'
            });
        }

        res.json({
            success: true,
            message: 'Enrollment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting enrollment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete enrollment'
        });
    }
});

// Bulk enroll students in a subject
router.post('/bulk', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { subject_id, student_ids } = req.body;

        if (!subject_id || !student_ids || !Array.isArray(student_ids)) {
            return res.status(400).json({
                success: false,
                error: 'Subject ID and array of Student IDs are required'
            });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const enrollments = [];
            const errors = [];

            for (const student_id of student_ids) {
                try {
                    // Check if enrollment already exists
                    const existing = await client.query(
                        'SELECT id FROM student_subjects WHERE student_id = $1 AND subject_id = $2',
                        [student_id, subject_id]
                    );

                    if (existing.rows.length === 0) {
                        const result = await client.query(
                            'INSERT INTO student_subjects (student_id, subject_id) VALUES ($1, $2) RETURNING *',
                            [student_id, subject_id]
                        );
                        enrollments.push(result.rows[0]);
                    } else {
                        errors.push(`Student ${student_id} is already enrolled`);
                    }
                } catch (error) {
                    errors.push(`Failed to enroll student ${student_id}: ${error.message}`);
                }
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Bulk enrollment completed. ${enrollments.length} students enrolled.`,
                data: {
                    enrollments,
                    errors: errors.length > 0 ? errors : undefined
                }
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error bulk enrolling students:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to bulk enroll students'
        });
    }
});

export default router; 