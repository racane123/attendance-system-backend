-- Migration script to update students table structure
-- Run this script to update your existing database

-- Step 1: Add new name columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name VARCHAR(50);

-- Step 2: Update existing records (if any) by splitting the name field
-- This assumes existing names are in format "First Last" or "First Middle Last"
UPDATE students 
SET 
    first_name = CASE 
        WHEN name IS NOT NULL THEN 
            CASE 
                WHEN array_length(string_to_array(name, ' '), 1) = 1 THEN name
                WHEN array_length(string_to_array(name, ' '), 1) = 2 THEN split_part(name, ' ', 1)
                WHEN array_length(string_to_array(name, ' '), 1) >= 3 THEN split_part(name, ' ', 1)
            END
    END,
    middle_name = CASE 
        WHEN name IS NOT NULL AND array_length(string_to_array(name, ' '), 1) >= 3 THEN 
            array_to_string(array_remove(string_to_array(name, ' '), split_part(name, ' ', 1)), ' ')
        ELSE NULL
    END,
    last_name = CASE 
        WHEN name IS NOT NULL THEN 
            CASE 
                WHEN array_length(string_to_array(name, ' '), 1) = 1 THEN NULL
                WHEN array_length(string_to_array(name, ' '), 1) = 2 THEN split_part(name, ' ', 2)
                WHEN array_length(string_to_array(name, ' '), 1) >= 3 THEN 
                    array_to_string(array_remove(array_remove(string_to_array(name, ' '), split_part(name, ' ', 1)), split_part(name, ' ', 2)), ' ')
            END
    END
WHERE first_name IS NULL OR last_name IS NULL;

-- Step 3: Make first_name and last_name NOT NULL (after data migration)
ALTER TABLE students ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE students ALTER COLUMN last_name SET NOT NULL;

-- Step 4: Drop the old name column (optional - uncomment if you want to remove it)
-- ALTER TABLE students DROP COLUMN name;

-- Step 5: Add some sample students with the new structure (if table is empty)
INSERT INTO students (student_id, first_name, middle_name, last_name, email, qr_code) VALUES
('STU001', 'John', 'Michael', 'Doe', 'john.doe@email.com', 'qr-john-doe-001'),
('STU002', 'Jane', NULL, 'Smith', 'jane.smith@email.com', 'qr-jane-smith-002'),
('STU003', 'Robert', 'James', 'Johnson', 'robert.johnson@email.com', 'qr-robert-johnson-003'),
('STU004', 'Emily', 'Grace', 'Williams', 'emily.williams@email.com', 'qr-emily-williams-004'),
('STU005', 'Michael', NULL, 'Brown', 'michael.brown@email.com', 'qr-michael-brown-005')
ON CONFLICT (student_id) DO NOTHING;

-- Verify the migration
SELECT 
    id, 
    student_id, 
    first_name, 
    middle_name, 
    last_name,
    CONCAT(first_name, ' ', COALESCE(middle_name || ' ', ''), last_name) as full_name,
    email 
FROM students 
ORDER BY id; 