import express from 'express';
import pool from '../database/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sendReservationNotification } from '../services/emailService.js';

const router = express.Router();

// Helper function to handle database errors
const handleError = (res, error, message = 'Database error') => {
  console.error('Library API Error:', error);
  res.status(500).json({ error: message });
};

// Helper function to check if user is librarian or admin
const requireLibrarian = (req, res, next) => {

  //console.log(req.user.role)
  if (req.user.role !== 'librarian' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Librarian privileges required.' });
  }
  next();
};

// ==================== BOOKS ROUTES ====================

// Get all books with filters
router.get('/books', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, genre, status, available } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (b.title ILIKE $${paramCount} OR b.author ILIKE $${paramCount} OR b.isbn ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (genre) {
      paramCount++;
      whereClause += ` AND b.genre = $${paramCount}`;
      params.push(genre);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND b.status = $${paramCount}`;
      params.push(status);
    }

    if (available === 'true') {
      whereClause += ' AND b.available_copies > 0';
    }

    const query = `
      SELECT 
        b.*,
        COUNT(bc.id) as total_copies,
        COUNT(CASE WHEN bc.status = 'available' THEN 1 END) as available_copies
      FROM books b
      LEFT JOIN book_copies bc ON b.id = bc.book_id
      ${whereClause}
      GROUP BY b.id
      ORDER BY b.title
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM books b
      LEFT JOIN book_copies bc ON b.id = bc.book_id
      ${whereClause}
    `;

    params.push(limit, offset);

    const [books, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    const totalBooks = parseInt(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalBooks / limit);

    res.json({
      books: books.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        total: totalBooks,
        totalPages
      }
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch books');
  }
});

// Get book by ID
router.get('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        b.*,
        COUNT(bc.id) as total_copies,
        COUNT(CASE WHEN bc.status = 'available' THEN 1 END) as available_copies
      FROM books b
      LEFT JOIN book_copies bc ON b.id = bc.book_id
      WHERE b.id = $1
      GROUP BY b.id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    handleError(res, error, 'Failed to fetch book');
  }
});

// Get available genres
router.get('/genres', async (req, res) => {
  try {
    const query = 'SELECT * FROM genres ORDER BY name';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Failed to fetch genres');
  }
});

// ==================== BORROWING ROUTES ====================

// Get user's borrowings
router.get('/borrowings', authenticateToken, async (req, res) => {
  try {
    // Get library user ID first
    const libraryUserQuery = 'SELECT id FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [req.user.id]);
    
    if (libraryUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in library system' });
    }
    
    const libraryUserId = libraryUserResult.rows[0].id;
    
    const query = `
      SELECT 
        b.id, b.borrowed_at, b.returned_at, b.due_date, b.status,
        bk.title, bk.author, bk.isbn, bk.cover_image_url,
        bc.copy_number,
        u.username as user_name,
        u.id as user_id 
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      JOIN books bk ON bc.book_id = bk.id
      JOIN library_users lu ON b.user_id = lu.id
      JOIN users u ON lu.user_id = u.id
      WHERE b.user_id = $1
      ORDER BY b.borrowed_at DESC
    `;
    
    const result = await pool.query(query, [libraryUserId]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Failed to fetch borrowings');
  }
});

// Borrow a book
router.post('/borrow', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    
    // Check if user has reached their borrowing limit
    const userQuery = 'SELECT id, max_borrow_limit FROM library_users WHERE user_id = $1';
    const userResult = await pool.query(userQuery, [req.user.id]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in library system' });
    }
    
    const libraryUserId = userResult.rows[0].id;
    const maxBooks = userResult.rows[0].max_borrow_limit;
    
    // Count current borrowings
    const currentBorrowingsQuery = `
      SELECT COUNT(*) as count 
      FROM borrowings 
      WHERE user_id = $1 AND status = 'borrowed'
    `;
    const currentResult = await pool.query(currentBorrowingsQuery, [libraryUserId]);
    const currentBorrowings = parseInt(currentResult.rows[0].count);
    
    if (currentBorrowings >= maxBooks) {
      return res.status(400).json({ error: `You have reached your borrowing limit of ${maxBooks} books` });
    }
    
    // Find available copy
    const copyQuery = `
      SELECT bc.id, bc.copy_number
      FROM book_copies bc
      WHERE bc.book_id = $1 AND bc.status = 'available'
      LIMIT 1
    `;
    const copyResult = await pool.query(copyQuery, [bookId]);
    
    if (copyResult.rows.length === 0) {
      return res.status(400).json({ error: 'No available copies of this book' });
    }
    
    const copyId = copyResult.rows[0].id;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks loan period

    // Create borrowing record
    const borrowQuery = `
      INSERT INTO borrowings (user_id, book_copy_id, due_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const borrowResult = await pool.query(borrowQuery, [libraryUserId, copyId, dueDate]);

    res.json({
      message: 'Book borrowed successfully',
      borrowing: borrowResult.rows[0],
      dueDate: dueDate
    });
  } catch (error) {
    handleError(res, error, 'Failed to borrow book');
  }
});

// Return a book
router.post('/return', authenticateToken, async (req, res) => {
  try {
    const { borrowingId } = req.body;
    
    // Get library user ID first
    const libraryUserQuery = 'SELECT id FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [req.user.id]);
    
    if (libraryUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in library system' });
    }
    
    const libraryUserId = libraryUserResult.rows[0].id;
    
    // Check if borrowing exists and belongs to user
    const borrowingQuery = `
      SELECT b.*, bc.book_id, bk.title
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      JOIN books bk ON bc.book_id = bk.id
      WHERE b.id = $1 AND b.user_id = $2
    `;
    const borrowingResult = await pool.query(borrowingQuery, [borrowingId, libraryUserId]);

    if (borrowingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Borrowing record not found' });
    }

    const borrowing = borrowingResult.rows[0];

    if (borrowing.status === 'returned') {
      return res.status(400).json({ error: 'Book has already been returned' });
    }
    
    // Calculate fine if overdue
    let fineAmount = 0;
    if (new Date() > new Date(borrowing.due_date)) {
      const daysOverdue = Math.ceil((new Date() - new Date(borrowing.due_date)) / (1000 * 60 * 60 * 24));
      fineAmount = daysOverdue * 0.50; // $0.50 per day
    }
    
    // Update borrowing record
    const returnQuery = `
      UPDATE borrowings 
      SET status = 'returned', returned_at = CURRENT_TIMESTAMP, fine_amount = $1
      WHERE id = $2
      RETURNING *
    `;
    
    const returnResult = await pool.query(returnQuery, [fineAmount, borrowingId]);
    
    // Create fine record if applicable
    if (fineAmount > 0) {
      const fineQuery = `
        INSERT INTO fines (borrowing_id, amount, reason)
        VALUES ($1, $2, 'Late return')
      `;
      await pool.query(fineQuery, [borrowingId, fineAmount]);
    }
    
    res.json({
      message: 'Book returned successfully',
      borrowing: returnResult.rows[0],
      fineAmount: fineAmount
    });
  } catch (error) {
    handleError(res, error, 'Failed to return book');
  }
});

// ==================== RESERVATION ROUTES (USER) ====================

// Create a reservation
router.post('/reservations', authenticateToken, async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;

    // Get the library user ID
    const libraryUserQuery = 'SELECT id FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [userId]);
    if (libraryUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library user not found' });
    }
    const libraryUserId = libraryUserResult.rows[0].id;

    // Check if the book is available
    const bookQuery = 'SELECT available_copies FROM books WHERE id = $1';
    const bookResult = await pool.query(bookQuery, [bookId]);
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    if (bookResult.rows[0].available_copies > 0) {
      return res.status(400).json({ error: 'Cannot reserve a book that is currently available' });
    }

    // Check for existing active reservation
    const existingReservationQuery = `
      SELECT id FROM reservations 
      WHERE user_id = $1 AND book_id = $2 AND status = 'active'
    `;
    const existingReservation = await pool.query(existingReservationQuery, [libraryUserId, bookId]);
    if (existingReservation.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active reservation for this book' });
    }

    // Create the reservation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Reservation expires in 7 days if not fulfilled

    const insertQuery = `
      INSERT INTO reservations (user_id, book_id, expires_at) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [libraryUserId, bookId, expiresAt]);

    res.status(201).json({
      message: 'Book reserved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    handleError(res, error, 'Failed to create reservation');
  }
});

// Get the current user's reservations
router.get('/reservations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const libraryUserQuery = 'SELECT id FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [userId]);
    if (libraryUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library user not found' });
    }
    const libraryUserId = libraryUserResult.rows[0].id;

    const query = `
      SELECT
        r.id, r.status, r.reserved_at, r.expires_at,
        b.id as book_id, b.title, b.author, b.cover_image_url
      FROM reservations r
      JOIN books b ON r.book_id = b.id
      WHERE r.user_id = $1
      ORDER BY r.reserved_at DESC
    `;
    const result = await pool.query(query, [libraryUserId]);

    res.json({ data: result.rows });
  } catch (error) {
    handleError(res, error, 'Failed to fetch user reservations');
  }
});


// ==================== ADMIN ROUTES ====================

// Add new book (Admin/Librarian only)
router.post('/books', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const {
      title, author, isbn, publisher, published_year, genre,
      description, total_copies, cover_image_url, location, call_number
    } = req.body;

    // Validate required fields
    if (!title || !author) {
      return res.status(400).json({ error: 'Title and author are required' });
    }
    
    // Insert book
    const bookQuery = `
      INSERT INTO books (title, author, isbn, publisher, published_year, genre, 
                        description, total_copies, cover_image_url, location, call_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const bookResult = await pool.query(bookQuery, [
      title, author, isbn, publisher, published_year, genre,
      description, total_copies || 1, cover_image_url, location, call_number
    ]);
    
    const book = bookResult.rows[0];
    
    // Create book copies
    const copiesToCreate = total_copies || 1;
    for (let i = 1; i <= copiesToCreate; i++) {
      const copyQuery = `
        INSERT INTO book_copies (book_id, copy_number, barcode)
        VALUES ($1, $2, $3)
      `;
      const barcode = `${isbn || 'LIB'}-${String(i).padStart(3, '0')}`;
      await pool.query(copyQuery, [book.id, i, barcode]);
    }

    res.status(201).json({
      message: 'Book added successfully',
      book: book
    });
  } catch (error) {
    handleError(res, error, 'Failed to add book');
  }
});

// Update book (Admin/Librarian only)
router.put('/books/:id', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramCount = 0;
    
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] !== undefined) {
        paramCount++;
        setClause.push(`${key} = $${paramCount}`);
        values.push(updateFields[key]);
      }
    });
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    paramCount++;
    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE books 
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }

    res.json({
      message: 'Book updated successfully',
      book: result.rows[0]
    });
  } catch (error) {
    handleError(res, error, 'Failed to update book');
  }
});

// Delete book (Admin/Librarian only)
router.delete('/books/:id', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if book has active borrowings
    const borrowingsQuery = `
      SELECT COUNT(*) as count
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      WHERE bc.book_id = $1 AND b.status = 'borrowed'
    `;
    const borrowingsResult = await pool.query(borrowingsQuery, [id]);
    
    if (parseInt(borrowingsResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete book with active borrowings' });
    }
    
    // Delete book (cascades to book_copies)
    const deleteQuery = 'DELETE FROM books WHERE id = $1 RETURNING *';
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Failed to delete book');
  }
});

// Get all borrowings (Admin/Librarian only)
router.get('/admin/borrowings', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, user_id } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      whereClause += ` AND b.status = $${paramCount}`;
      params.push(status);
    }
    
    if (user_id) {
      paramCount++;
      whereClause += ` AND b.user_id = $${paramCount}`;
      params.push(user_id);
    }
    
    const query = `
      SELECT 
        b.*,
        bk.title, bk.author, bk.isbn,
        bc.copy_number,
        u.username as user_name, u.email as user_email
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      JOIN books bk ON bc.book_id = bk.id
      JOIN library_users lu ON b.user_id = lu.id
      JOIN users u ON lu.user_id = u.id
      ${whereClause}
      ORDER BY b.borrowed_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    params.push(limit, offset);
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Failed to fetch borrowings');
  }
});

// Get library statistics (Admin/Librarian only)
router.get('/admin/stats', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const stats = {};
    
    // Total books
    const totalBooksQuery = 'SELECT COUNT(*) as count FROM books';
    const totalBooksResult = await pool.query(totalBooksQuery);
    stats.totalBooks = parseInt(totalBooksResult.rows[0].count);
    
    // Total copies
    const totalCopiesQuery = 'SELECT COUNT(*) as count FROM book_copies';
    const totalCopiesResult = await pool.query(totalCopiesQuery);
    stats.totalCopies = parseInt(totalCopiesResult.rows[0].count);
    
    // Available copies
    const availableCopiesQuery = "SELECT COUNT(*) as count FROM book_copies WHERE status = 'available'";
    const availableCopiesResult = await pool.query(availableCopiesQuery);
    stats.availableCopies = parseInt(availableCopiesResult.rows[0].count);
    
    // Active borrowings
    const activeBorrowingsQuery = "SELECT COUNT(*) as count FROM borrowings WHERE status = 'borrowed'";
    const activeBorrowingsResult = await pool.query(activeBorrowingsQuery);
    stats.activeBorrowings = parseInt(activeBorrowingsResult.rows[0].count);
    
    // Overdue books
    const overdueQuery = `
      SELECT COUNT(*) as count 
      FROM borrowings 
      WHERE status = 'borrowed' AND due_date < CURRENT_TIMESTAMP
    `;
    const overdueResult = await pool.query(overdueQuery);
    stats.overdueBooks = parseInt(overdueResult.rows[0].count);
    
    // Total users
    const totalUsersQuery = 'SELECT COUNT(*) as count FROM library_users';
    const totalUsersResult = await pool.query(totalUsersQuery);
    stats.totalUsers = parseInt(totalUsersResult.rows[0].count);
    
    res.json(stats);
  } catch (error) {
    handleError(res, error, 'Failed to fetch statistics');
  }
});



// Admin: Search for active borrowings
router.get('/admin/borrowings/search', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const query = `
      SELECT
        b.id as borrowing_id,
        bk.title,
        u.username
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      JOIN books bk ON bc.book_id = bk.id
      JOIN library_users lu ON b.user_id = lu.id
      JOIN users u ON lu.user_id = u.id
      WHERE b.status = 'borrowed' AND (bk.title ILIKE $1 OR bk.isbn = $1 OR u.username ILIKE $1)
      LIMIT 10
    `;
    const result = await pool.query(query, [`%${q}%`]);
    res.json(result.rows);
  } catch (error) {
    handleError(res, error, 'Failed to search borrowings');
  }
});

// ==================== RESERVATION ROUTES (ADMIN) ====================

// Get all active reservations
router.get('/admin/reservations', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.reserved_at,
        r.expires_at,
        r.status,
        b.title as book_title,
        u.username as user_name,
        u.email as user_email
      FROM reservations r
      JOIN books b ON r.book_id = b.id
      JOIN library_users lu ON r.user_id = lu.id
      JOIN users u ON lu.user_id = u.id
      WHERE r.status = 'active'
      ORDER BY r.reserved_at ASC
    `;
    const result = await pool.query(query);
    res.json({ data: result.rows });
  } catch (error) {
    handleError(res, error, 'Failed to fetch reservations');
  }
});

// Fulfill a reservation
router.post('/admin/reservations/:id/fulfill', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { id } = req.params;

    // Get reservation details to find user email and book title
    const reservationQuery = `
      SELECT r.*, u.email, u.username, b.title 
      FROM reservations r
      JOIN library_users lu ON r.user_id = lu.id
      JOIN users u ON lu.user_id = u.id
      JOIN books b ON r.book_id = b.id
      WHERE r.id = $1 AND r.status = 'active'
    `;
    const reservationResult = await pool.query(reservationQuery, [id]);

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Active reservation not found' });
    }

    const reservation = reservationResult.rows[0];

    // Update the reservation status
    const updateQuery = `
      UPDATE reservations 
      SET status = 'fulfilled', expires_at = NOW() + INTERVAL '3 day'
      WHERE id = $1 
      RETURNING *
    `;
    const updatedResult = await pool.query(updateQuery, [id]);

    // Trigger an email notification to the user
    await sendReservationNotification(
      reservation.email,
      {
        userName: reservation.username,
        bookTitle: reservation.title,
        reservationId: reservation.id,
      },
      req.user.id 
    );

    res.json({
      message: 'Reservation fulfilled and notification sent.',
      data: updatedResult.rows[0],
    });
  } catch (error) {
    handleError(res, error, 'Failed to fulfill reservation');
  }
});


// Admin: Issue a book to a user
router.post('/admin/issue', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { userId, bookId } = req.body;
    // Find an available copy of the book
    const copyQuery = `
      SELECT id FROM book_copies
      WHERE book_id = $1 AND status = 'available'
      LIMIT 1
    `;
    const copyResult = await pool.query(copyQuery, [bookId]);

    if (copyResult.rows.length === 0) {
      return res.status(400).json({ error: 'No available copies of this book.' });
    }
    const copyId = copyResult.rows[0].id;

    // Get library user ID from the main user ID
    const libraryUserQuery = 'SELECT id FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [userId]);
    if (libraryUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library user not found.' });
    }
    const libraryUserId = libraryUserResult.rows[0].id;

    // Create borrowing record
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2 weeks loan

    const borrowQuery = `
      INSERT INTO borrowings (user_id, book_copy_id, due_date)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const borrowResult = await pool.query(borrowQuery, [libraryUserId, copyId, dueDate]);

    // Update book copy status to 'borrowed'
    await pool.query('UPDATE book_copies SET status = \'borrowed\' WHERE id = $1', [copyId]);

    res.status(201).json({
      message: 'Book issued successfully',
      borrowing: borrowResult.rows[0]
    });

  } catch (error) {
    handleError(res, error, 'Failed to issue book');
  }
});

// Get a specific user's borrowing history (Admin/Librarian only)
router.get('/admin/borrowings/:userId', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { userId } = req.params;

    // First, get the library_user_id from the main user_id
    const libraryUserQuery = 'SELECT id FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [userId]);

    if (libraryUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Library user not found' });
    }
    const libraryUserId = libraryUserResult.rows[0].id;

    const query = `
      SELECT 
        b.id,
        b.borrowed_at,
        b.returned_at,
        bk.title as book_title
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      JOIN books bk ON bc.book_id = bk.id
      WHERE b.user_id = $1
      ORDER BY b.borrowed_at DESC
    `;

    const result = await pool.query(query, [libraryUserId]);
    res.json({ data: result.rows });
  } catch (error) {
    handleError(res, error, "Failed to fetch user's borrowing history");
  }
});

// Admin: Return a book
router.post('/admin/return', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { borrowingId } = req.body;

    // Get borrowing details
    const borrowingQuery = 'SELECT * FROM borrowings WHERE id = $1';
    const borrowingResult = await pool.query(borrowingQuery, [borrowingId]);

    if (borrowingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Borrowing record not found.' });
    }
    const borrowing = borrowingResult.rows[0];

    if (borrowing.status === 'returned') {
      return res.status(400).json({ error: 'This book has already been returned.' });
    }

    // Update borrowing record
    const updateBorrowingQuery = `
      UPDATE borrowings
      SET status = 'returned', returned_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await pool.query(updateBorrowingQuery, [borrowingId]);

    // Update book copy status
    const updateCopyQuery = `
      UPDATE book_copies
      SET status = 'available'
      WHERE id = $1
    `;
    await pool.query(updateCopyQuery, [borrowing.book_copy_id]);
    
    // TODO: Calculate and apply fines if overdue

    res.json({ message: 'Book returned successfully.' });

  } catch (error) {
    handleError(res, error, 'Failed to return book');
  }
});

// Admin: Renew a book
router.post('/admin/borrowings/:id/renew', authenticateToken, requireLibrarian, async (req, res) => {
  try {
    const { id } = req.params;

    const borrowingQuery = 'SELECT * FROM borrowings WHERE id = $1';
    const borrowingResult = await pool.query(borrowingQuery, [id]);

    if (borrowingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Borrowing record not found.' });
    }
    const borrowing = borrowingResult.rows[0];

    if (borrowing.status !== 'borrowed') {
      return res.status(400).json({ error: 'This book is not currently borrowed.' });
    }

    // Extend due date by 14 days
    const newDueDate = new Date(borrowing.due_date);
    newDueDate.setDate(newDueDate.getDate() + 14);

    const updateQuery = 'UPDATE borrowings SET due_date = $1 WHERE id = $2';
    await pool.query(updateQuery, [newDueDate, id]);

    res.json({ message: 'Book renewed successfully.', newDueDate });

  } catch (error) {
    handleError(res, error, 'Failed to renew book');
  }
});


export default router; 