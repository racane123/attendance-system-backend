import express from "express";
import dotenv from 'dotenv';
import cors from 'cors';
import { initializeCronJobs } from './services/cronService.js';
import pool from './database/db.js';

//internal imports
import scanRouter from "./router/scan.js";
import studentRouter from "./router/student.js";
import subjectRouter from "./router/subject.js";
import authRouter from "./router/auth.js";
import emailRouter from "./router/email.js";
import emailManagementRouter from "./router/emailManagement.js";
import enrollmentRouter from "./router/enrollment.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Trust proxy for ngrok compatibility
app.set('trust proxy', 1);

//middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow ngrok URLs and localhost
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      /^https:\/\/.*\.ngrok\.io$/,
      /^https:\/\/.*\.ngrok-free\.app$/,
      /^https:\/\/.*\.ngrok\.app$/,
      'https://e586-136-158-39-55.ngrok-free.app',
      'https://caa9-136-158-39-55.ngrok-free.app',
      'https://687425591349dd0008e4a0b7--visionary-salmiakki-588f3d.netlify.app/'
    ];
    
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      return allowedOrigin.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Database initialization function
const initializeDatabase = async () => {
  try {
    console.log('Initializing database...');
    
    // Test database connection
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected successfully:', result.rows[0]);
    
    // Check if tables exist by querying the users table
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Setting up database tables...');
      
      // Create tables
      await pool.query(`
        -- Create students table
        CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            student_id VARCHAR(20) UNIQUE NOT NULL,
            first_name VARCHAR(50) NOT NULL,
            middle_name VARCHAR(50),
            last_name VARCHAR(50) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            qr_code VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create subjects table
        CREATE TABLE IF NOT EXISTS subjects (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(20) UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create attendance_records table
        CREATE TABLE IF NOT EXISTS attendance_records (
            id SERIAL PRIMARY KEY,
            student_id INTEGER REFERENCES students(id),
            subject_id INTEGER REFERENCES subjects(id),
            date DATE NOT NULL,
            time_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) DEFAULT 'present',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, subject_id, date)
        );

        -- Create sessions table for tracking active scanning sessions
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            subject_id INTEGER REFERENCES subjects(id),
            start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_time TIMESTAMP,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create users table for authentication
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher', 'viewer')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create email_history table for tracking sent emails
        CREATE TABLE IF NOT EXISTS email_history (
            id SERIAL PRIMARY KEY,
            recipient_email VARCHAR(100) NOT NULL,
            email_type VARCHAR(50) NOT NULL,
            subject VARCHAR(200) NOT NULL,
            message_id VARCHAR(100),
            status VARCHAR(20) DEFAULT 'sent',
            sent_by INTEGER REFERENCES users(id),
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create email_preferences table for user email settings
        CREATE TABLE IF NOT EXISTS email_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            email_type VARCHAR(50) NOT NULL,
            enabled BOOLEAN DEFAULT true,
            frequency VARCHAR(20) DEFAULT 'daily',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, email_type)
        );
      `);
      
      console.log('Database tables created successfully');
      
      // Insert sample data
      await pool.query(`
        INSERT INTO subjects (name, code, description) VALUES
        ('Mathematics', 'MATH101', 'Introduction to Mathematics'),
        ('Physics', 'PHY101', 'Basic Physics'),
        ('Computer Science', 'CS101', 'Introduction to Programming'),
        ('English', 'ENG101', 'English Literature'),
        ('History', 'HIST101', 'World History')
        ON CONFLICT (code) DO NOTHING;
      `);
      
      // Create default admin user (password: admin123)
      const bcrypt = await import('bcryptjs');
      const adminPassword = await bcrypt.hash('admin123', 10);
      
      await pool.query(`
        INSERT INTO users (username, email, password_hash, role) VALUES
        ('admin', 'admin@attendance.com', $1, 'admin')
        ON CONFLICT (username) DO NOTHING;
      `, [adminPassword]);
      
      console.log('Sample data inserted successfully');
    } else {
      console.log('Database tables already exist');
    }
    
  } catch (error) {
    console.error('Database initialization error:', error);
    // Don't exit the process, just log the error
  }
};

// Routes
app.use("/api/auth", authRouter);
app.use("/api/scan", scanRouter);
app.use('/api/students', studentRouter);
app.use('/api/subjects', subjectRouter);
app.use('/api/email', emailRouter);
app.use('/api/email-management', emailManagementRouter);
app.use('/api/enrollments', enrollmentRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

//listen
app.listen(PORT, async () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
    
    // Initialize database and cron jobs after server starts
    await initializeDatabase();
    initializeCronJobs();
});









