-- Create students table
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
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

-- Create email_history table for tracking sent emails
CREATE TABLE IF NOT EXISTS email_history (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(100) NOT NULL,
    email_type VARCHAR(50) NOT NULL, -- 'attendance_report', 'daily_summary', 'notification', 'welcome'
    subject VARCHAR(200) NOT NULL,
    message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'failed', 'pending'
    sent_by INTEGER, -- user ID who triggered the email
    metadata JSONB, -- additional data like subject_id, date, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create email_preferences table for user email settings
CREATE TABLE IF NOT EXISTS email_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    frequency VARCHAR(20) DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'never'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_type)
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

-- Insert some sample subjects
INSERT INTO subjects (name, code, description) VALUES
('Mathematics', 'MATH101', 'Introduction to Mathematics'),
('Physics', 'PHY101', 'Basic Physics'),
('Computer Science', 'CS101', 'Introduction to Programming'),
('English', 'ENG101', 'English Literature'),
('History', 'HIST101', 'World History')
ON CONFLICT (code) DO NOTHING;

-- Insert default admin user (password: admin123)
-- Note: This is a pre-hashed password for 'admin123'
INSERT INTO users (username, email, password_hash, role) VALUES
('admin', 'admin@attendance.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (username) DO NOTHING; 