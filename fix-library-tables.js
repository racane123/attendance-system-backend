import dotenv from 'dotenv';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixLibraryTables() {
  try {
    console.log('Checking library tables...');
    
    // Check all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%book%' OR table_name LIKE '%genre%' OR table_name LIKE '%library%' OR table_name LIKE '%borrow%'
    `);
    
    console.log('All related tables:', tablesResult.rows.map(r => r.table_name));
    
    // Create missing tables
    const createBookCopies = `
      CREATE TABLE IF NOT EXISTS book_copies (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        copy_number INTEGER NOT NULL,
        barcode VARCHAR(50) UNIQUE,
        condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('new', 'good', 'fair', 'poor')),
        status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'borrowed', 'reserved', 'maintenance', 'lost')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(book_id, copy_number)
      );
    `;
    
    const createGenres = `
      CREATE TABLE IF NOT EXISTS genres (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    const insertGenres = `
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
    `;
    
    // Create missing tables
    await pool.query(createBookCopies);
    console.log('✅ book_copies table created');
    
    await pool.query(createGenres);
    console.log('✅ genres table created');
    
    await pool.query(insertGenres);
    console.log('✅ Default genres inserted');
    
    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_book_copies_status ON book_copies(status)',
      'CREATE INDEX IF NOT EXISTS idx_book_copies_book_id ON book_copies(book_id)',
      'CREATE INDEX IF NOT EXISTS idx_genres_name ON genres(name)'
    ];
    
    for (const index of indexes) {
      await pool.query(index);
    }
    console.log('✅ Indexes created');
    
    console.log('🎉 Library tables fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing library tables:', error);
  } finally {
    await pool.end();
  }
}

fixLibraryTables(); 