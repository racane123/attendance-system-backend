import  pool  from './database/db.js';
import bcrypt from 'bcryptjs';

const setupDatabase = async () => {
  try {
    console.log('Setting up database...');

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
          email_type VARCHAR(50) NOT NULL, -- 'attendance_report', 'daily_summary', 'notification', 'welcome'
          subject VARCHAR(200) NOT NULL,
          message_id VARCHAR(100),
          status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'pending'
          sent_by INTEGER REFERENCES users(id),
          metadata JSONB, -- additional data like subject_id, date, etc.
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create email_preferences table for user email settings
      CREATE TABLE IF NOT EXISTS email_preferences (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          email_type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT true,
          frequency VARCHAR(20) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'never'
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, email_type)
      );
    `);

    console.log('Tables created successfully');

    // Insert sample subjects
    await pool.query(`
      INSERT INTO subjects (name, code, description) VALUES
      ('Mathematics', 'MATH101', 'Introduction to Mathematics'),
      ('Physics', 'PHY101', 'Basic Physics'),
      ('Computer Science', 'CS101', 'Introduction to Programming'),
      ('English', 'ENG101', 'English Literature'),
      ('History', 'HIST101', 'World History')
      ON CONFLICT (code) DO NOTHING;
    `);

    console.log('Sample subjects inserted');

    // Create sample users with hashed passwords
    const saltRounds = 10;
    const adminPassword = await bcrypt.hash('admin123', saltRounds);
    const teacherPassword = await bcrypt.hash('teacher123', saltRounds);
    const viewerPassword = await bcrypt.hash('viewer123', saltRounds);

    await pool.query(`
      INSERT INTO users (username, email, password_hash, role) VALUES
      ('admin', 'admin@attendance.com', $1, 'admin'),
      ('teacher', 'teacher@attendance.com', $2, 'teacher'),
      ('viewer', 'viewer@attendance.com', $3, 'viewer')
      ON CONFLICT (username) DO NOTHING;
    `, [adminPassword, teacherPassword, viewerPassword]);

    console.log('Sample users created');

    // Insert sample students
    await pool.query(`
      INSERT INTO students (student_id, first_name, middle_name, last_name, email, qr_code) VALUES
      ('STU001', 'John', 'Michael', 'Doe', 'john.doe@student.com', 'qr-john-doe-001'),
      ('STU002', 'Jane', 'Elizabeth', 'Smith', 'jane.smith@student.com', 'qr-jane-smith-002'),
      ('STU003', 'Robert', 'James', 'Johnson', 'robert.johnson@student.com', 'qr-robert-johnson-003'),
      ('STU004', 'Emily', 'Grace', 'Williams', 'emily.williams@student.com', 'qr-emily-williams-004'),
      ('STU005', 'Michael', 'David', 'Brown', 'michael.brown@student.com', 'qr-michael-brown-005')
      ON CONFLICT (student_id) DO NOTHING;
    `);

    console.log('Sample students inserted');

    // Create default email preferences for sample users
    await pool.query(`
      INSERT INTO email_preferences (user_id, email_type, enabled, frequency) VALUES
      (1, 'daily_summary', true, 'daily'),
      (1, 'attendance_report', true, 'daily'),
      (1, 'notification', true, 'daily'),
      (2, 'daily_summary', true, 'daily'),
      (2, 'attendance_report', true, 'daily'),
      (3, 'daily_summary', true, 'weekly')
      ON CONFLICT (user_id, email_type) DO NOTHING;
    `);

    console.log('Default email preferences created');

    console.log('Database setup completed successfully!');
    console.log('\nDefault credentials:');
    console.log('Admin: admin / admin123');
    console.log('Teacher: teacher / teacher123');
    console.log('Viewer: viewer / viewer123');

  } catch (error) {
    console.error('Error setting up database:', error);
  } finally {
    await pool.end();
  }
};

setupDatabase(); 