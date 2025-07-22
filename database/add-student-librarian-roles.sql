-- Add 'student' and 'librarian' to the role check constraint in the users table
ALTER TABLE users
DROP CONSTRAINT users_role_check,
ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'viewer', 'student', 'librarian')); 