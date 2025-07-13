import express from "express";
import pool from "../database/db.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { sendStudentAttendanceEmail } from "../services/emailService.js";

const scanRouter = express.Router();

// ===== SESSION MANAGEMENT =====

// Start a new scanning session for a subject
scanRouter.post("/session/start", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { subject_id } = req.body;
        
        if (!subject_id) {
            return res.status(400).json({
                success: false,
                error: 'Subject ID is required'
            });
        }

        // Check if subject exists
        const subjectCheck = await pool.query(
            "SELECT * FROM subjects WHERE id = $1",
            [subject_id]
        );

        if (subjectCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Subject not found'
            });
        }

        // Check if there's already an active session for this subject
        const activeSessionCheck = await pool.query(
            "SELECT * FROM sessions WHERE subject_id = $1 AND is_active = true",
            [subject_id]
        );

        if (activeSessionCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'There is already an active session for this subject'
            });
        }

        // Create new session
        const result = await pool.query(
            "INSERT INTO sessions (subject_id, start_time, is_active) VALUES ($1, CURRENT_TIMESTAMP, true) RETURNING *",
            [subject_id]
        );

        res.status(201).json({
            success: true,
            message: 'Scanning session started successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start scanning session'
        });
    }
});

// End a scanning session
scanRouter.put("/session/end/:session_id", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { session_id } = req.params;

        const result = await pool.query(
            "UPDATE sessions SET end_time = CURRENT_TIMESTAMP, is_active = false WHERE id = $1 AND is_active = true RETURNING *",
            [session_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Active session not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Scanning session ended successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to end scanning session'
        });
    }
});

// Get active sessions
scanRouter.get("/session/active", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.*, sub.name as subject_name, sub.code as subject_code 
             FROM sessions s 
             JOIN subjects sub ON s.subject_id = sub.id 
             WHERE s.is_active = true 
             ORDER BY s.start_time DESC`
        );

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active sessions'
        });
    }
});

// Get session by ID with attendance details
scanRouter.get("/session/:session_id", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const { session_id } = req.params;

        const result = await pool.query(
            `SELECT s.*, sub.name as subject_name, sub.code as subject_code,
                    COUNT(ar.id) as total_attendance
             FROM sessions s 
             JOIN subjects sub ON s.subject_id = sub.id 
             LEFT JOIN attendance_records ar ON s.subject_id = ar.subject_id 
                    AND DATE(ar.date) = DATE(s.start_time)
             WHERE s.id = $1
             GROUP BY s.id, sub.name, sub.code`,
            [session_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch session'
        });
    }
});

// ===== QR CODE SCANNING =====

// Process QR code scan and record attendance
scanRouter.post("/scan", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { qr_code, subject_id } = req.body;

        if (!qr_code || !subject_id) {
            return res.status(400).json({
                success: false,
                error: 'QR code and subject ID are required'
            });
        }

        // Check if there's an active session for this subject
        const sessionCheck = await pool.query(
            "SELECT * FROM sessions WHERE subject_id = $1 AND is_active = true",
            [subject_id]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No active scanning session for this subject'
            });
        }

        // Find student by QR code
        const studentResult = await pool.query(
            "SELECT * FROM students WHERE qr_code = $1",
            [qr_code]
        );

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Student not found with this QR code'
            });
        }

        const student = studentResult.rows[0];
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // Check if attendance already recorded for today
        const existingAttendance = await pool.query(
            "SELECT * FROM attendance_records WHERE student_id = $1 AND subject_id = $2 AND date = $3",
            [student.id, subject_id, today]
        );

        if (existingAttendance.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Attendance already recorded for this student today',
                data: {
                    student: student,
                    attendance: existingAttendance.rows[0]
                }
            });
        }

        // Record attendance
        const attendanceResult = await pool.query(
            "INSERT INTO attendance_records (student_id, subject_id, date, time_in, status) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'present') RETURNING *",
            [student.id, subject_id, today]
        );

        // Get subject details for email
        const subjectResult = await pool.query(
            "SELECT * FROM subjects WHERE id = $1",
            [subject_id]
        );

        const subject = subjectResult.rows[0];
        const attendance = attendanceResult.rows[0];

        // Send email notification to student
        try {
            const attendanceData = {
                studentId: student.student_id,
                studentName: `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`,
                studentEmail: student.email,
                section: student.section,
                subjectName: subject.name,
                subjectCode: subject.code,
                date: today,
                time: new Date(attendance.time_in).toLocaleTimeString(),
                attendanceId: attendance.id,
                generatedAt: new Date().toLocaleString()
            };

            const emailResult = await sendStudentAttendanceEmail(student.email, attendanceData, req.user.id);
            
            if (emailResult.success) {
                console.log(`Attendance email sent to ${student.email} for ${subject.name}`);
            } else {
                console.error(`Failed to send attendance email to ${student.email}:`, emailResult.error);
            }
        } catch (emailError) {
            console.error('Error sending attendance email:', emailError);
            // Don't fail the scan if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Attendance recorded successfully',
            data: {
                student: student,
                attendance: attendanceResult.rows[0]
            }
        });
    } catch (error) {
        console.error('Error processing scan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process scan'
        });
    }
});

// ===== ATTENDANCE RECORDS =====

// Get attendance records for a subject on a specific date
scanRouter.get("/attendance/:subject_id/:date", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const { subject_id, date } = req.params;

        const result = await pool.query(
            `SELECT ar.*, 
                    s.first_name, s.middle_name, s.last_name,
                    CONCAT(s.first_name, ' ', COALESCE(s.middle_name || ' ', ''), s.last_name) as student_name,
                    s.student_id as student_number, s.email
             FROM attendance_records ar
             JOIN students s ON ar.student_id = s.id
             WHERE ar.subject_id = $1 AND ar.date = $2
             ORDER BY ar.time_in ASC`,
            [subject_id, date]
        );

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching attendance records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch attendance records'
        });
    }
});

// Get attendance summary for a subject
scanRouter.get("/attendance/summary/:subject_id", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const { subject_id } = req.params;
        const { start_date, end_date } = req.query;

        let dateFilter = "";
        let params = [subject_id];

        if (start_date && end_date) {
            dateFilter = "AND ar.date BETWEEN $2 AND $3";
            params.push(start_date, end_date);
        }

        const result = await pool.query(
            `SELECT 
                ar.date,
                COUNT(ar.id) as total_attendance,
                COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
                COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count
             FROM attendance_records ar
             WHERE ar.subject_id = $1 ${dateFilter}
             GROUP BY ar.date
             ORDER BY ar.date DESC`,
            params
        );

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch attendance summary'
        });
    }
});

// Update attendance status (for manual corrections)
scanRouter.put("/attendance/:record_id", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { record_id } = req.params;
        const { status } = req.body;

        if (!status || !['present', 'absent', 'late'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Valid status (present, absent, late) is required'
            });
        }

        const result = await pool.query(
            "UPDATE attendance_records SET status = $1 WHERE id = $2 RETURNING *",
            [status, record_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Attendance record not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Attendance status updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update attendance'
        });
    }
});

// Delete attendance record
scanRouter.delete("/attendance/:record_id", authenticateToken, requireRole(['admin']), async (req, res) => {
    try {
        const { record_id } = req.params;

        const result = await pool.query(
            "DELETE FROM attendance_records WHERE id = $1 RETURNING *",
            [record_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Attendance record not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Attendance record deleted successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting attendance record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete attendance record'
        });
    }
});

// ===== MANUAL ATTENDANCE MANAGEMENT =====

// Get all students for a subject (for manual attendance)
scanRouter.get("/students/:subject_id", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { subject_id } = req.params;
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                error: 'Date parameter is required'
            });
        }

        console.log(`Fetching students for subject ${subject_id} on date ${date}`);

        // Get all students enrolled in this subject and their attendance status for the given date
        // If no attendance record exists, default to 'absent' status
        const result = await pool.query(
            `SELECT 
                s.id, s.first_name, s.middle_name, s.last_name, s.student_id, s.email, s.section,
                s.first_name || ' ' || COALESCE(s.middle_name || ' ', '') || s.last_name as full_name,
                ar.id as attendance_id, 
                COALESCE(ar.status, 'absent') as status, 
                ar.time_in,
                CASE WHEN ar.id IS NULL THEN true ELSE false END as is_default_absent
             FROM students s
             JOIN student_subjects ss ON s.id = ss.student_id AND ss.is_active = true
             LEFT JOIN attendance_records ar ON s.id = ar.student_id 
                AND ar.subject_id = $1 
                AND ar.date = $2
             WHERE ss.subject_id = $1
             ORDER BY s.last_name, s.first_name`,
            [subject_id, date]
        );

        console.log(`Found ${result.rows.length} students for manual attendance`);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching students for manual attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch students'
        });
    }
});

// Manually record attendance for a student
scanRouter.post("/attendance/manual", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { student_id, subject_id, date, status, time_in } = req.body;

        if (!student_id || !subject_id || !date || !status) {
            return res.status(400).json({
                success: false,
                error: 'Student ID, subject ID, date, and status are required'
            });
        }

        if (!['present', 'absent', 'late'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status must be present, absent, or late'
            });
        }

        // Check if attendance already exists for this student on this date
        const existingAttendance = await pool.query(
            "SELECT * FROM attendance_records WHERE student_id = $1 AND subject_id = $2 AND date = $3",
            [student_id, subject_id, date]
        );

        if (existingAttendance.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Attendance already recorded for this student on this date',
                data: existingAttendance.rows[0]
            });
        }

        // Record attendance
        const attendanceResult = await pool.query(
            "INSERT INTO attendance_records (student_id, subject_id, date, time_in, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [student_id, subject_id, date, time_in || new Date(), status]
        );

        // Get student and subject details for email (only if present)
        if (status === 'present') {
            try {
                const studentResult = await pool.query(
                    "SELECT * FROM students WHERE id = $1",
                    [student_id]
                );
                const subjectResult = await pool.query(
                    "SELECT * FROM subjects WHERE id = $1",
                    [subject_id]
                );

                if (studentResult.rows.length > 0 && subjectResult.rows.length > 0) {
                    const student = studentResult.rows[0];
                    const subject = subjectResult.rows[0];
                    const attendance = attendanceResult.rows[0];

                    const attendanceData = {
                        studentId: student.student_id,
                        studentName: `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`,
                        studentEmail: student.email,
                        section: student.section,
                        subjectName: subject.name,
                        subjectCode: subject.code,
                        date: date,
                        time: new Date(attendance.time_in).toLocaleTimeString(),
                        attendanceId: attendance.id,
                        generatedAt: new Date().toLocaleString()
                    };

                    const emailResult = await sendStudentAttendanceEmail(student.email, attendanceData, req.user.id);
                    
                    if (emailResult.success) {
                        console.log(`Manual attendance email sent to ${student.email} for ${subject.name}`);
                    } else {
                        console.error(`Failed to send manual attendance email to ${student.email}:`, emailResult.error);
                    }
                }
            } catch (emailError) {
                console.error('Error sending manual attendance email:', emailError);
                // Don't fail the manual attendance if email fails
            }
        }

        res.status(201).json({
            success: true,
            message: 'Manual attendance recorded successfully',
            data: attendanceResult.rows[0]
        });
    } catch (error) {
        console.error('Error recording manual attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record manual attendance'
        });
    }
});

// Update manual attendance
scanRouter.put("/attendance/manual/:record_id", authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
    try {
        const { record_id } = req.params;
        const { status, time_in } = req.body;

        if (!status || !['present', 'absent', 'late'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Valid status (present, absent, late) is required'
            });
        }

        const result = await pool.query(
            "UPDATE attendance_records SET status = $1, time_in = $2 WHERE id = $3 RETURNING *",
            [status, time_in || new Date(), record_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Attendance record not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Manual attendance updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating manual attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update manual attendance'
        });
    }
});

// ===== UTILITY ENDPOINTS =====

// Get today's attendance for all subjects
scanRouter.get("/today", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const result = await pool.query(
            `SELECT 
                sub.name as subject_name,
                sub.code as subject_code,
                COUNT(ar.id) as attendance_count,
                s.start_time as session_start
             FROM subjects sub
             LEFT JOIN sessions s ON sub.id = s.subject_id AND s.is_active = true
             LEFT JOIN attendance_records ar ON sub.id = ar.subject_id AND ar.date = $1
             GROUP BY sub.id, sub.name, sub.code, s.start_time
             ORDER BY sub.name`,
            [today]
        );

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching today\'s attendance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch today\'s attendance'
        });
    }
});

// Health check for scan router
scanRouter.get("/", authenticateToken, requireRole(['admin', 'teacher', 'viewer']), (req, res) => {
    res.status(200).json({
        success: true,
        message: "Scan router is working",
        endpoints: {
            "POST /session/start": "Start a new scanning session",
            "PUT /session/end/:id": "End a scanning session",
            "GET /session/active": "Get all active sessions",
            "GET /session/:id": "Get session details",
            "POST /scan": "Process QR code scan",
            "GET /attendance/:subject_id/:date": "Get attendance for subject on date",
            "GET /attendance/summary/:subject_id": "Get attendance summary",
            "PUT /attendance/:id": "Update attendance status",
            "DELETE /attendance/:id": "Delete attendance record",
            "GET /today": "Get today's attendance overview"
        }
    });
});

export default scanRouter;