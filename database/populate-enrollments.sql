-- Populate student enrollments based on actual data
-- This script will enroll all students in all subjects for testing

-- First, let's see what we have
SELECT 'Students:' as info;
SELECT id, first_name, last_name FROM students ORDER BY id;

SELECT 'Subjects:' as info;
SELECT id, name, code FROM subjects ORDER BY id;

-- Now enroll all students in all subjects
INSERT INTO student_subjects (student_id, subject_id)
SELECT s.id, sub.id
FROM students s
CROSS JOIN subjects sub
WHERE NOT EXISTS (
    SELECT 1 FROM student_subjects ss 
    WHERE ss.student_id = s.id AND ss.subject_id = sub.id
);

-- Show the enrollments
SELECT 'Enrollments created:' as info;
SELECT 
    s.first_name || ' ' || s.last_name as student_name,
    sub.name as subject_name,
    ss.enrollment_date
FROM student_subjects ss
JOIN students s ON ss.student_id = s.id
JOIN subjects sub ON ss.subject_id = sub.id
ORDER BY s.last_name, s.first_name, sub.name; 