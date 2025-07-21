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

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // Check if library tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('books', 'book_copies', 'library_users', 'borrowings', 'genres')
    `);
    
    console.log('Existing tables:', tablesResult.rows.map(r => r.table_name));
    
    if (tablesResult.rows.length === 0) {
      console.log('No library tables found. Creating them...');
      
      // Read and execute the library schema
      const schemaPath = path.join(__dirname, 'database', 'library-schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      await pool.query(schemaSQL);
      console.log('✅ Library tables created successfully');
    } else {
      console.log('✅ Library tables already exist');
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await pool.end();
  }
}

testConnection(); 