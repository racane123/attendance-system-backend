-- Student-Subject Enrollment Migration
-- This table tracks which students are enrolled in which subjects

-- Create student_subjects table
CREATE TABLE IF NOT EXISTS student_subjects (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id ON student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_id ON student_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_subjects_active ON student_subjects(is_active);

-- Add some sample enrollments (adjust student and subject IDs as needed)
-- You can run this after creating the table to populate with sample data
INSERT INTO student_subjects (student_id, subject_id) VALUES
    (13, 1), -- John Doe in Mathematics
    (13, 2), -- John Doe in Physics
    (13, 3), -- John Doe in Computer Science
    (19, 1), -- test test in Mathematics
    (19, 3), -- test test in Computer Science
    (22, 1), -- test test in Mathematics
    (22, 4), -- test test in English
    (22, 5); -- test test in History

-- Update the updated_at column when records are modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_subjects_updated_at 
    BEFORE UPDATE ON student_subjects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 