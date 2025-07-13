-- Complete database setup script
-- Run this to create all tables with the new structure

-- Create students table with new name structure
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    section VARCHAR(20) NOT NULL DEFAULT 'A',
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

-- Insert sample subjects
INSERT INTO subjects (name, code, description) VALUES
('Mathematics', 'MATH101', 'Introduction to Mathematics'),
('Physics', 'PHY101', 'Basic Physics'),
('Computer Science', 'CS101', 'Introduction to Programming'),
('English', 'ENG101', 'English Literature'),
('History', 'HIST101', 'World History')
ON CONFLICT (code) DO NOTHING;

-- Insert sample students with new name structure
INSERT INTO students (student_id, first_name, middle_name, last_name, email, qr_code, section) VALUES
('STU001', 'John', 'Michael', 'Doe', 'john.doe@email.com', 'qr-john-doe-001', 'A'),
('STU002', 'Jane', NULL, 'Smith', 'jane.smith@email.com', 'qr-jane-smith-002', 'A'),
('STU003', 'Robert', 'James', 'Johnson', 'robert.johnson@email.com', 'qr-robert-johnson-003', 'A'),
('STU004', 'Emily', 'Grace', 'Williams', 'emily.williams@email.com', 'qr-emily-williams-004', 'B'),
('STU005', 'Michael', NULL, 'Brown', 'michael.brown@email.com', 'qr-michael-brown-005', 'B'),
('STU006', 'Sarah', 'Elizabeth', 'Davis', 'sarah.davis@email.com', 'qr-sarah-davis-006', 'B'),
('STU007', 'David', 'William', 'Miller', 'david.miller@email.com', 'qr-david-miller-007', 'C'),
('STU008', 'Lisa', NULL, 'Wilson', 'lisa.wilson@email.com', 'qr-lisa-wilson-008', 'C'),
('STU009', 'James', 'Thomas', 'Taylor', 'james.taylor@email.com', 'qr-james-taylor-009', 'C'),
('STU010', 'Amanda', 'Rose', 'Anderson', 'amanda.anderson@email.com', 'qr-amanda-anderson-010', 'C')
ON CONFLICT (student_id) DO NOTHING;

-- Verify the setup
SELECT 'Database setup completed successfully!' as status;

-- Show sample data
SELECT 'Students:' as table_name;
SELECT 
    id, 
    student_id, 
    first_name, 
    middle_name, 
    last_name,
    section,
    CONCAT(first_name, ' ', COALESCE(middle_name || ' ', ''), last_name) as full_name,
    email 
FROM students 
ORDER BY section, last_name, first_name;

SELECT 'Subjects:' as table_name;
SELECT * FROM subjects ORDER BY id; 