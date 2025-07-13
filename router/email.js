import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../database/db.js';
import { 
  sendAttendanceReport, 
  sendDailySummary, 
  sendNotification, 
  sendWelcomeEmail,
  testEmailConfig,
  sendStudentAttendanceEmail
} from '../services/emailService.js';
import { 
  sendDailySummaryToAll, 
  sendWeeklySummaryToAll, 
  sendSubjectAttendanceReports 
} from '../services/scheduledEmailService.js';
import { triggerDailySummary, triggerWeeklySummary } from '../services/cronService.js';

const router = express.Router();

// Test email configuration (admin only)
router.post('/test', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await testEmailConfig();
    if (result.success) {
      res.json({ success: true, message: 'Email configuration is valid' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ success: false, error: 'Failed to test email configuration' });
  }
});

// Send attendance report email
router.post('/attendance-report', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { subjectId, date, recipientEmail } = req.body;

    if (!subjectId || !date || !recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subject ID, date, and recipient email are required' 
      });
    }

    // Get subject details
    const subjectResult = await pool.query(
      'SELECT * FROM subjects WHERE id = $1',
      [subjectId]
    );

    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    const subject = subjectResult.rows[0];

    // Get attendance records for the date
    const attendanceResult = await pool.query(
      `SELECT ar.*, s.student_id, s.first_name, s.middle_name, s.last_name
       FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       WHERE ar.subject_id = $1 AND ar.date = $2
       ORDER BY s.first_name, s.last_name`,
      [subjectId, date]
    );

    const attendanceRecords = attendanceResult.rows;

    // Get all students for this subject to calculate absent students
    const studentsResult = await pool.query(
      'SELECT * FROM students ORDER BY first_name, last_name'
    );

    const allStudents = studentsResult.rows;
    const presentStudentIds = attendanceRecords.map(record => record.student_id);
    const absentStudents = allStudents.filter(student => !presentStudentIds.includes(student.id));

    // Add absent students to records
    const allRecords = [
      ...attendanceRecords,
      ...absentStudents.map(student => ({
        student_id: student.student_id,
        student_name: `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`,
        status: 'absent',
        time_in: null
      }))
    ];

    const totalStudents = allStudents.length;
    const presentCount = attendanceRecords.length;
    const absentCount = absentStudents.length;
    const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    const reportData = {
      subjectName: subject.name,
      date: date,
      totalStudents,
      presentCount,
      absentCount,
      attendancePercentage,
      attendanceRecords: allRecords,
      generatedAt: new Date().toLocaleString()
    };

    const result = await sendAttendanceReport(recipientEmail, reportData);

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Attendance report sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Send attendance report error:', error);
    res.status(500).json({ success: false, error: 'Failed to send attendance report' });
  }
});

// Send daily summary email
router.post('/daily-summary', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { date, recipientEmail } = req.body;

    if (!date || !recipientEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'Date and recipient email are required' 
      });
    }

    // Get all subjects with attendance data for the date
    const subjectsResult = await pool.query(
      `SELECT s.*, 
              COUNT(DISTINCT st.id) as total_students,
              COUNT(ar.id) as present_count
       FROM subjects s
       LEFT JOIN students st ON 1=1
       LEFT JOIN attendance_records ar ON s.id = ar.subject_id 
         AND ar.date = $1 
         AND ar.student_id = st.id
       GROUP BY s.id, s.name, s.code
       ORDER BY s.name`,
      [date]
    );

    const subjects = subjectsResult.rows.map(subject => {
      const attendanceRate = subject.total_students > 0 
        ? Math.round((subject.present_count / subject.total_students) * 100) 
        : 0;
      
      let rateClass = 'low';
      if (attendanceRate >= 80) rateClass = 'high';
      else if (attendanceRate >= 60) rateClass = 'medium';

      return {
        name: subject.name,
        code: subject.code,
        totalStudents: parseInt(subject.total_students),
        presentCount: parseInt(subject.present_count),
        absentCount: parseInt(subject.total_students) - parseInt(subject.present_count),
        attendanceRate,
        rateClass
      };
    });

    const totalSubjects = subjects.length;
    const totalStudents = subjects.reduce((sum, subject) => sum + subject.totalStudents, 0);
    const totalPresent = subjects.reduce((sum, subject) => sum + subject.presentCount, 0);
    const overallAttendance = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

    const summaryData = {
      date,
      totalSubjects,
      totalStudents,
      overallAttendance,
      subjects,
      generatedAt: new Date().toLocaleString()
    };

    const result = await sendDailySummary(recipientEmail, summaryData);

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Daily summary sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Send daily summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to send daily summary' });
  }
});

// Send custom notification
router.post('/notification', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { recipientEmail, subject, message } = req.body;

    if (!recipientEmail || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient email, subject, and message are required' 
      });
    }

    const notificationData = {
      subject,
      message,
      sentAt: new Date().toLocaleString()
    };

    const result = await sendNotification(recipientEmail, notificationData);

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Notification sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
  }
});

// Send daily summary to all users (admin only)
router.post('/send-daily-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { date } = req.body;
    const results = await sendDailySummaryToAll(date);
    
    res.json({
      success: true,
      message: 'Daily summary sent to all users',
      results
    });
  } catch (error) {
    console.error('Send daily summary to all error:', error);
    res.status(500).json({ success: false, error: 'Failed to send daily summary to all users' });
  }
});

// Send weekly summary to all users (admin only)
router.post('/send-weekly-summary', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { endDate } = req.body;
    const results = await sendWeeklySummaryToAll(endDate);
    
    res.json({
      success: true,
      message: 'Weekly summary sent to all users',
      results
    });
  } catch (error) {
    console.error('Send weekly summary to all error:', error);
    res.status(500).json({ success: false, error: 'Failed to send weekly summary to all users' });
  }
});

// Send subject attendance report to all users (admin/teacher only)
router.post('/send-subject-report', authenticateToken, requireRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { subjectId, date } = req.body;
    
    if (!subjectId) {
      return res.status(400).json({
        success: false,
        error: 'Subject ID is required'
      });
    }
    
    const results = await sendSubjectAttendanceReports(subjectId, date);
    
    res.json({
      success: true,
      message: 'Subject attendance report sent to all users',
      results
    });
  } catch (error) {
    console.error('Send subject report error:', error);
    res.status(500).json({ success: false, error: 'Failed to send subject attendance report' });
  }
});

// Manual trigger endpoints for testing (admin only)
router.post('/trigger-daily', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const results = await triggerDailySummary();
    res.json({
      success: true,
      message: 'Daily summary triggered manually',
      results
    });
  } catch (error) {
    console.error('Manual daily trigger error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger daily summary' });
  }
});

router.post('/trigger-weekly', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const results = await triggerWeeklySummary();
    res.json({
      success: true,
      message: 'Weekly summary triggered manually',
      results
    });
  } catch (error) {
    console.error('Manual weekly trigger error:', error);
    res.status(500).json({ success: false, error: 'Failed to trigger weekly summary' });
  }
});

// Test student attendance email (admin only)
router.post('/test-student-attendance', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { studentId, subjectId, date } = req.body;

    if (!studentId || !subjectId || !date) {
      return res.status(400).json({
        success: false,
        error: 'Student ID, subject ID, and date are required'
      });
    }

    // Get student details
    const studentResult = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Get subject details
    const subjectResult = await pool.query(
      'SELECT * FROM subjects WHERE id = $1',
      [subjectId]
    );

    if (subjectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found'
      });
    }

    const student = studentResult.rows[0];
    const subject = subjectResult.rows[0];

    const attendanceData = {
      studentId: student.student_id,
      studentName: `${student.first_name} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name}`,
      studentEmail: student.email,
      section: student.section,
      subjectName: subject.name,
      subjectCode: subject.code,
      date: date,
      time: new Date().toLocaleTimeString(),
      attendanceId: 999, // Test ID
      generatedAt: new Date().toLocaleString()
    };

    const result = await sendStudentAttendanceEmail(student.email, attendanceData, req.user.id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Student attendance email sent successfully',
        messageId: result.messageId,
        data: attendanceData
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Test student attendance email error:', error);
    res.status(500).json({ success: false, error: 'Failed to send test student attendance email' });
  }
});

export default router; 