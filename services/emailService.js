import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email configuration
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password'
  }
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);


// Load email templates
const loadTemplate = (templateName) => {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.hbs`);
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  return handlebars.compile(templateSource);
};

// Send attendance report email
export const sendAttendanceReport = async (recipientEmail, reportData, sentBy = null) => {
  try {
    const template = loadTemplate('attendance-report');
    const html = template(reportData);

    const mailOptions = {
      from: `"Attendance System" <${emailConfig.auth.user}>`,
      to: recipientEmail,
      subject: `Attendance Report - ${reportData.subjectName} - ${reportData.date}`,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Attendance report email sent:', result.messageId);
    
    // Track email in database
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'attendance_report',
      subject: mailOptions.subject,
      message_id: result.messageId,
      sent_by: sentBy,
      metadata: { subject_id: reportData.subjectId, date: reportData.date }
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending attendance report email:', error);
    
    // Track failed email
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'attendance_report',
      subject: `Attendance Report - ${reportData.subjectName} - ${reportData.date}`,
      status: 'failed',
      sent_by: sentBy,
      metadata: { subject_id: reportData.subjectId, date: reportData.date, error: error.message }
    });
    
    return { success: false, error: error.message };
  }
};

// Send daily summary email
export const sendDailySummary = async (recipientEmail, summaryData, sentBy = null) => {
  try {
    const template = loadTemplate('daily-summary');
    const html = template(summaryData);

    const mailOptions = {
      from: `"Attendance System" <${emailConfig.auth.user}>`,
      to: recipientEmail,
      subject: `Daily Attendance Summary - ${summaryData.date}`,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Daily summary email sent:', result.messageId);
    
    // Track email in database
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'daily_summary',
      subject: mailOptions.subject,
      message_id: result.messageId,
      sent_by: sentBy,
      metadata: { date: summaryData.date }
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending daily summary email:', error);
    
    // Track failed email
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'daily_summary',
      subject: `Daily Attendance Summary - ${summaryData.date}`,
      status: 'failed',
      sent_by: sentBy,
      metadata: { date: summaryData.date, error: error.message }
    });
    
    return { success: false, error: error.message };
  }
};

// Send notification email
export const sendNotification = async (recipientEmail, notificationData, sentBy = null) => {
  try {
    const template = loadTemplate('notification');
    const html = template(notificationData);

    const mailOptions = {
      from: `"Attendance System" <${emailConfig.auth.user}>`,
      to: recipientEmail,
      subject: notificationData.subject,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Notification email sent:', result.messageId);
    
    // Track email in database
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'notification',
      subject: mailOptions.subject,
      message_id: result.messageId,
      sent_by: sentBy,
      metadata: { subject: notificationData.subject }
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending notification email:', error);
    
    // Track failed email
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'notification',
      subject: notificationData.subject,
      status: 'failed',
      sent_by: sentBy,
      metadata: { subject: notificationData.subject, error: error.message }
    });
    
    return { success: false, error: error.message };
  }
};

// Send welcome email to new users
export const sendWelcomeEmail = async (recipientEmail, userData, sentBy = null) => {
  try {
    const template = loadTemplate('welcome');
    const html = template(userData);

    const mailOptions = {
      from: `"Attendance System" <${emailConfig.auth.user}>`,
      to: recipientEmail,
      subject: 'Welcome to the Attendance Management System',
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', result.messageId);
    
    // Track email in database
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'welcome',
      subject: mailOptions.subject,
      message_id: result.messageId,
      sent_by: sentBy,
      metadata: { username: userData.username, role: userData.role }
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    
    // Track failed email
    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'welcome',
      subject: 'Welcome to the Attendance Management System',
      status: 'failed',
      sent_by: sentBy,
      metadata: { username: userData.username, role: userData.role, error: error.message }
    });
    
    return { success: false, error: error.message };
  }
};

// Track email history in database
const trackEmailHistory = async (emailData) => {
  try {
    const { recipient_email, email_type, subject, message_id, status = 'sent', sent_by, metadata } = emailData;
    
    await pool.query(
      `INSERT INTO email_history (recipient_email, email_type, subject, message_id, status, sent_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [recipient_email, email_type, subject, message_id, status, sent_by, metadata]
    );
  } catch (error) {
    console.error('Error tracking email history:', error);
  }
};

// Send student attendance confirmation email
export const sendStudentAttendanceEmail = async (studentEmail, attendanceData, sentBy = null) => {
  try {
    const template = loadTemplate('student-attendance');
    const html = template(attendanceData);

    const mailOptions = {
      from: `"Attendance System" <${emailConfig.auth.user}>`,
      to: studentEmail,
      subject: `Attendance Confirmation - ${attendanceData.subjectName} - ${attendanceData.date}`,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Student attendance email sent:', result.messageId);
    
    // Track email in database
    await trackEmailHistory({
      recipient_email: studentEmail,
      email_type: 'student_attendance',
      subject: mailOptions.subject,
      message_id: result.messageId,
      sent_by: sentBy,
      metadata: { 
        student_id: attendanceData.studentId, 
        subject_id: attendanceData.subjectId, 
        date: attendanceData.date,
        attendance_id: attendanceData.attendanceId
      }
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending student attendance email:', error);
    
    // Track failed email
    await trackEmailHistory({
      recipient_email: studentEmail,
      email_type: 'student_attendance',
      subject: `Attendance Confirmation - ${attendanceData.subjectName} - ${attendanceData.date}`,
      status: 'failed',
      sent_by: sentBy,
      metadata: { 
        student_id: attendanceData.studentId, 
        subject_id: attendanceData.subjectId, 
        date: attendanceData.date,
        attendance_id: attendanceData.attendanceId,
        error: error.message 
      }
    });
    
    return { success: false, error: error.message };
  }
};

// Send reservation notification email
export const sendReservationNotification = async (recipientEmail, notificationData, sentBy = null) => {
  try {
    const template = loadTemplate('reservation-notification');
    const html = template(notificationData);

    const mailOptions = {
      from: `"School Library" <${emailConfig.auth.user}>`,
      to: recipientEmail,
      subject: `Your Reserved Book is Available: ${notificationData.bookTitle}`,
      html: html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Reservation notification email sent:', result.messageId);

    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'reservation_notification',
      subject: mailOptions.subject,
      message_id: result.messageId,
      sent_by: sentBy,
      metadata: { 
        reservation_id: notificationData.reservationId, 
        book_title: notificationData.bookTitle 
      },
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending reservation notification email:', error);

    await trackEmailHistory({
      recipient_email: recipientEmail,
      email_type: 'reservation_notification',
      subject: `Your Reserved Book is Available: ${notificationData.bookTitle}`,
      status: 'failed',
      sent_by: sentBy,
      metadata: { 
        reservation_id: notificationData.reservationId, 
        book_title: notificationData.bookTitle,
        error: error.message 
      },
    });

    return { success: false, error: error.message };
  }
};


// Test email configuration
export const testEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    return { success: true };
  } catch (error) {
    console.error('Email configuration error:', error);
    return { success: false, error: error.message };
  }
}; 