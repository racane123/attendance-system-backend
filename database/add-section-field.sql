-- Migration script to add section field to students table
-- Run this script to add the section column to existing students table

-- Add section column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS section VARCHAR(20);

-- Update existing students with default sections
UPDATE students SET section = 'A' WHERE section IS NULL;

-- Make section NOT NULL after setting default values
ALTER TABLE students ALTER COLUMN section SET NOT NULL;

-- Add index for better performance when filtering by section
CREATE INDEX IF NOT EXISTS idx_students_section ON students(section);

-- Update sample students with different sections
UPDATE students SET section = 'A' WHERE student_id IN ('STU001', 'STU002', 'STU003');
UPDATE students SET section = 'B' WHERE student_id IN ('STU004', 'STU005', 'STU006');
UPDATE students SET section = 'C' WHERE student_id IN ('STU007', 'STU008', 'STU009', 'STU010');

-- Verify the changes
SELECT 'Section field added successfully!' as status;

-- Show updated student data
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