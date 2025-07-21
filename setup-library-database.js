import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupLibraryDatabase() {
  try {
    console.log('Setting up library database...');
    
    // Read and execute the library schema
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const schemaPath = path.join(__dirname, 'database', 'library-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schemaSQL);
    console.log('✅ Library schema created successfully');
    
    // Insert sample books
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
      },
      {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        isbn: '9780141439518',
        publisher: 'Penguin Books',
        published_year: 1813,
        genre: 'Romance',
        description: 'A classic romance novel about the relationship between Elizabeth Bennet and Mr. Darcy.',
        total_copies: 2,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Fiction Section A',
        call_number: 'FIC AUS'
      },
      {
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        isbn: '9780547928241',
        publisher: 'Houghton Mifflin',
        published_year: 1937,
        genre: 'Fantasy',
        description: 'A fantasy novel about a hobbit\'s journey to help reclaim a dwarf kingdom.',
        total_copies: 3,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Fiction Section C',
        call_number: 'FIC TOL'
      },
      {
        title: 'A Brief History of Time',
        author: 'Stephen Hawking',
        isbn: '9780553109535',
        publisher: 'Bantam Books',
        published_year: 1988,
        genre: 'Science',
        description: 'An exploration of cosmology and the universe\'s biggest mysteries.',
        total_copies: 2,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Non-Fiction Section A',
        call_number: 'SCI HAW'
      },
      {
        title: 'The Art of War',
        author: 'Sun Tzu',
        isbn: '9780140439199',
        publisher: 'Penguin Books',
        published_year: -500,
        genre: 'History',
        description: 'Ancient Chinese text on military strategy and tactics.',
        total_copies: 1,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Non-Fiction Section B',
        call_number: 'HIS SUN'
      },
      {
        title: 'The Catcher in the Rye',
        author: 'J.D. Salinger',
        isbn: '9780316769488',
        publisher: 'Little, Brown and Company',
        published_year: 1951,
        genre: 'Literature',
        description: 'A novel about teenage alienation and loss of innocence in post-World War II America.',
        total_copies: 2,
        cover_image_url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
        location: 'Fiction Section A',
        call_number: 'FIC SAL'
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
        
        // Create book copies
        for (let i = 1; i <= book.total_copies; i++) {
          const copyQuery = `
            INSERT INTO book_copies (book_id, copy_number, barcode)
            VALUES ($1, $2, $3)
          `;
          const barcode = `${book.isbn || 'LIB'}-${String(i).padStart(3, '0')}`;
          await pool.query(copyQuery, [bookId, i, barcode]);
        }
      }
    }
    
    console.log('✅ Sample books inserted successfully');
    
    // Create library user for existing admin user
    const adminUserQuery = `
      INSERT INTO library_users (user_id, library_card_number, name, email, role, max_borrow_limit)
      SELECT id, 'LIB-ADMIN-001', username, email, 'librarian', 10
      FROM users 
      WHERE username = 'admin'
      ON CONFLICT (user_id) DO NOTHING
    `;
    await pool.query(adminUserQuery);
    console.log('✅ Library admin user created');
    
    console.log('🎉 Library database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up library database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupLibraryDatabase()
    .then(() => {
      console.log('Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export default setupLibraryDatabase; 