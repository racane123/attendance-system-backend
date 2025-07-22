    -- Step 1: Add the 'name' column back to library_users, if it doesn't exist
    ALTER TABLE library_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

    -- Step 2: Drop the 'name' and 'full_name' columns from the users table, if they exist
    ALTER TABLE users DROP COLUMN IF EXISTS name;
    ALTER TABLE users DROP COLUMN IF EXISTS full_name;