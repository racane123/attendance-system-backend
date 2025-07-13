import { sendDailySummary, sendAttendanceReport } from './emailService.js';
import { getUsersForEmailType } from '../router/emailManagement.js';
import pool from '../database/db.js';

// Send daily summary to all users who have enabled it
export const sendDailySummaryToAll = async (date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
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
      [targetDate]
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
      date: targetDate,
      totalSubjects,
      totalStudents,
      overallAttendance,
      subjects,
      generatedAt: new Date().toLocaleString()
    };

    // Get users who want daily summaries
    const users = await getUsersForEmailType('daily_summary', 'daily');
    
    const results = [];
    for (const user of users) {
      try {
        const result = await sendDailySummary(user.email, summaryData, user.id);
        results.push({
          user: user.username,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
      } catch (error) {
        results.push({
          user: user.username,
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Daily summary sent to ${users.length} users for ${targetDate}`);
    return results;
  } catch (error) {
    console.error('Error sending daily summary to all users:', error);
    throw error;
  }
};

// Send weekly summary to users who have enabled it
export const sendWeeklySummaryToAll = async (endDate = null) => {
  try {
    const targetEndDate = endDate || new Date().toISOString().split('T')[0];
    const startDate = new Date(targetEndDate);
    startDate.setDate(startDate.getDate() - 7);
    const targetStartDate = startDate.toISOString().split('T')[0];
    
    // Get weekly attendance data
    const weeklyResult = await pool.query(
      `SELECT 
        s.name as subject_name,
        s.code as subject_code,
        COUNT(DISTINCT st.id) as total_students,
        COUNT(ar.id) as total_attendance,
        COUNT(DISTINCT ar.student_id) as unique_students_present
       FROM subjects s
       LEFT JOIN students st ON 1=1
       LEFT JOIN attendance_records ar ON s.id = ar.subject_id 
         AND ar.date BETWEEN $1 AND $2
         AND ar.student_id = st.id
       GROUP BY s.id, s.name, s.code
       ORDER BY s.name`,
      [targetStartDate, targetEndDate]
    );

    const subjects = weeklyResult.rows.map(subject => {
      const attendanceRate = subject.total_students > 0 
        ? Math.round((subject.unique_students_present / subject.total_students) * 100) 
        : 0;
      
      return {
        name: subject.subject_name,
        code: subject.subject_code,
        totalStudents: parseInt(subject.total_students),
        totalAttendance: parseInt(subject.total_attendance),
        uniqueStudentsPresent: parseInt(subject.unique_students_present),
        attendanceRate
      };
    });

    const summaryData = {
      startDate: targetStartDate,
      endDate: targetEndDate,
      period: 'Weekly',
      totalSubjects: subjects.length,
      subjects,
      generatedAt: new Date().toLocaleString()
    };

    // Get users who want weekly summaries
    const users = await getUsersForEmailType('daily_summary', 'weekly');
    
    const results = [];
    for (const user of users) {
      try {
        const result = await sendDailySummary(user.email, summaryData, user.id);
        results.push({
          user: user.username,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
      } catch (error) {
        results.push({
          user: user.username,
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Weekly summary sent to ${users.length} users for week ending ${targetEndDate}`);
    return results;
  } catch (error) {
    console.error('Error sending weekly summary to all users:', error);
    throw error;
  }
};

// Send attendance reports for specific subjects
export const sendSubjectAttendanceReports = async (subjectId, date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Get subject details
    const subjectResult = await pool.query(
      'SELECT * FROM subjects WHERE id = $1',
      [subjectId]
    );

    if (subjectResult.rows.length === 0) {
      throw new Error('Subject not found');
    }

    const subject = subjectResult.rows[0];

    // Get attendance records for the date
    const attendanceResult = await pool.query(
      `SELECT ar.*, s.student_id, s.name as student_name
       FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       WHERE ar.subject_id = $1 AND ar.date = $2
       ORDER BY s.name`,
      [subjectId, targetDate]
    );

    const attendanceRecords = attendanceResult.rows;

    // Get all students for this subject to calculate absent students
    const studentsResult = await pool.query(
      'SELECT * FROM students ORDER BY name'
    );

    const allStudents = studentsResult.rows;
    const presentStudentIds = attendanceRecords.map(record => record.student_id);
    const absentStudents = allStudents.filter(student => !presentStudentIds.includes(student.id));

    // Add absent students to records
    const allRecords = [
      ...attendanceRecords,
      ...absentStudents.map(student => ({
        student_id: student.student_id,
        student_name: student.name,
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
      subjectId: subject.id,
      date: targetDate,
      totalStudents,
      presentCount,
      absentCount,
      attendancePercentage,
      attendanceRecords: allRecords,
      generatedAt: new Date().toLocaleString()
    };

    // Get users who want attendance reports
    const users = await getUsersForEmailType('attendance_report', 'daily');
    
    const results = [];
    for (const user of users) {
      try {
        const result = await sendAttendanceReport(user.email, reportData, user.id);
        results.push({
          user: user.username,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
          error: result.error
        });
      } catch (error) {
        results.push({
          user: user.username,
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Attendance report for ${subject.name} sent to ${users.length} users for ${targetDate}`);
    return results;
  } catch (error) {
    console.error('Error sending subject attendance reports:', error);
    throw error;
  }
}; 