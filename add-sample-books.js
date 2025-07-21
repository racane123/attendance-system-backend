import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addSampleBooks() {
  try {
    console.log('Adding sample books...');
    
    const sampleBooks = [
      {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '9780743273565',
        publisher: 'Scribner',
        published_year: 1925,
        genre: 'Literature',
        description: 'A novel set in the Roaring Twenties that explores themes of decadence, idealism, and the American Dream.',
        total_copies: 3,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Fiction Section A',
        call_number: 'FIC FIT'
      },
      {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '9780061120084',
        publisher: 'J.B. Lippincott & Co.',
        published_year: 1960,
        genre: 'Literature',
        description: 'A powerful story of racial injustice in the Deep South, told through the eyes of a young girl.',
        total_copies: 2,
        cover_image_url: 'https://covers.openlibrary.org/b/id/8228691-L.jpg',
        location: 'Fiction Section A',
        call_number: 'FIC LEE'
      },
      {
        title: '1984',
        author: 'George Orwell',
        isbn: '9780451524935',
        publisher: 'Secker & Warburg',
        published_year: 1949,
        genre: 'Science Fiction',
        description: 'A dystopian novel about totalitarianism and surveillance society.',
        total_copies: 4,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Fiction Section B',
        call_number: 'FIC ORW'
      }
    ];
    
    for (const book of sampleBooks) {
      // Insert book
      const bookQuery = `
        INSERT INTO books (title, author, isbn, publisher, published_year, genre, 
                          description, total_copies, cover_image_url, location, call_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (isbn) DO NOTHING
        RETURNING id
      `;
      
      const bookResult = await pool.query(bookQuery, [
        book.title, book.author, book.isbn, book.publisher, book.published_year,
        book.genre, book.description, book.total_copies, book.cover_image_url,
        book.location, book.call_number
      ]);
      
      if (bookResult.rows.length > 0) {
        const bookId = bookResult.rows[0].id;
        console.log(`✅ Added book: ${book.title} (ID: ${bookId})`);
        
        // Create book copies
        for (let i = 1; i <= book.total_copies; i++) {
          const copyQuery = `
            INSERT INTO book_copies (book_id, copy_number, barcode)
            VALUES ($1, $2, $3)
          `;
          const barcode = `${book.isbn || 'LIB'}-${String(i).padStart(3, '0')}`;
          await pool.query(copyQuery, [bookId, i, barcode]);
        }
        console.log(`✅ Created ${book.total_copies} copies for ${book.title}`);
      } else {
        console.log(`⚠️ Book already exists: ${book.title}`);
      }
    }
    
    console.log('🎉 Sample books added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding sample books:', error);
  } finally {
    await pool.end();
  }
}

addSampleBooks(); 