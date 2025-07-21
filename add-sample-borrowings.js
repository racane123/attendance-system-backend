import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addSampleBorrowings() {
  try {
    console.log('Adding sample borrowings...');
    
    // Get admin user
    const adminQuery = 'SELECT id FROM users WHERE username = $1';
    const adminResult = await pool.query(adminQuery, ['admin']);
    const adminId = adminResult.rows[0].id;
    
    // Get some books and their copies
    const booksQuery = 'SELECT id FROM books LIMIT 3';
    const booksResult = await pool.query(booksQuery);
    
    for (const book of booksResult.rows) {
      // Get available copy for this book
      const copyQuery = `
        SELECT id FROM book_copies 
        WHERE book_id = $1 AND status = 'available' 
        LIMIT 1
      `;
      const copyResult = await pool.query(copyQuery, [book.id]);
      
      if (copyResult.rows.length > 0) {
        const copyId = copyResult.rows[0].id;
        
        // Create borrowing
        const borrowQuery = `
          INSERT INTO borrowings (user_id, book_copy_id, due_date, status)
          VALUES ($1, $2, $3, $4)
        `;
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // 2 weeks from now
        
        await pool.query(borrowQuery, [adminId, copyId, dueDate, 'borrowed']);
        
        // Update copy status
        await pool.query('UPDATE book_copies SET status = $1 WHERE id = $2', ['borrowed', copyId]);
        
        console.log(`✅ Added borrowing for book ID ${book.id}`);
      }
    }
    
    console.log('🎉 Sample borrowings added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding sample borrowings:', error.message);
  } finally {
    await pool.end();
  }
}

addSampleBorrowings(); 