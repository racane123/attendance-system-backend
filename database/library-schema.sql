-- Library Management System Database Schema

-- Create library_users table (extends existing users table)
CREATE TABLE IF NOT EXISTS library_users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    library_card_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'librarian', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    max_borrow_limit INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create books table
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(20) UNIQUE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    publisher VARCHAR(255),
    published_year INTEGER,
    genre VARCHAR(100),
    description TEXT,
    total_copies INTEGER DEFAULT 1,
    available_copies INTEGER DEFAULT 1,
    cover_image_url VARCHAR(500),
    location VARCHAR(100), -- Shelf location
    call_number VARCHAR(50), -- Library classification number
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'lost')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create book_copies table for individual copy tracking
CREATE TABLE IF NOT EXISTS book_copies (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    copy_number INTEGER NOT NULL, -- Copy number (1, 2, 3, etc.)
    barcode VARCHAR(50) UNIQUE,
    condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor')),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'reserved', 'maintenance', 'lost')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, copy_number)
);

-- Create borrowings table
CREATE TABLE IF NOT EXISTS borrowings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES library_users(id) ON DELETE CASCADE,
    book_copy_id INTEGER REFERENCES book_copies(id) ON DELETE CASCADE,
    borrowed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    returned_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES library_users(id) ON DELETE CASCADE,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'expired', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create fines table
CREATE TABLE IF NOT EXISTS fines (
    id SERIAL PRIMARY KEY,
    borrowing_id INTEGER REFERENCES borrowings(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived')),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create genres table for better organization
CREATE TABLE IF NOT EXISTS genres (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default genres
INSERT INTO genres (name, description) VALUES
('Fiction', 'Imaginative literature'),
('Non-Fiction', 'Factual literature'),
('Science Fiction', 'Speculative fiction with scientific elements'),
('Mystery', 'Suspense and detective stories'),
('Romance', 'Love stories'),
('Biography', 'Life stories of real people'),
('History', 'Historical accounts and analysis'),
('Science', 'Scientific literature and textbooks'),
('Mathematics', 'Mathematical literature and textbooks'),
('Literature', 'Classic and contemporary literature'),
('Children', 'Books for young readers'),
('Reference', 'Reference materials and encyclopedias')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_genre ON books(genre);
CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON borrowings(user_id);
CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status);
CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON borrowings(due_date);
CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status);
CREATE INDEX IF NOT EXISTS idx_library_users_email ON library_users(email);
CREATE INDEX IF NOT EXISTS idx_library_users_card_number ON library_users(library_card_number);

-- Create triggers to update available_copies count
CREATE OR REPLACE FUNCTION update_book_available_copies()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Decrease available copies when book is borrowed
        UPDATE books 
        SET available_copies = available_copies - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT book_id FROM book_copies WHERE id = NEW.book_copy_id);
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle status changes
        IF OLD.status = 'borrowed' AND NEW.status = 'returned' THEN
            -- Increase available copies when book is returned
            UPDATE books 
            SET available_copies = available_copies + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT book_id FROM book_copies WHERE id = NEW.book_copy_id);
        ELSIF OLD.status = 'available' AND NEW.status = 'borrowed' THEN
            -- Decrease available copies when book is borrowed
            UPDATE books 
            SET available_copies = available_copies - 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT book_id FROM book_copies WHERE id = NEW.book_copy_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_available_copies
    AFTER INSERT OR UPDATE ON borrowings
    FOR EACH ROW
    EXECUTE FUNCTION update_book_available_copies();

-- Create trigger to update book_copies status
CREATE OR REPLACE FUNCTION update_book_copy_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Set book copy status to borrowed
        UPDATE book_copies 
        SET status = 'borrowed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.book_copy_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'borrowed' AND NEW.status = 'returned' THEN
            -- Set book copy status to available
            UPDATE book_copies 
            SET status = 'available',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.book_copy_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_book_copy_status
    AFTER INSERT OR UPDATE ON borrowings
    FOR EACH ROW
    EXECUTE FUNCTION update_book_copy_status(); 