import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to books table...');
    
    // Add location column
    await pool.query(`
      ALTER TABLE books 
      ADD COLUMN IF NOT EXISTS location VARCHAR(100)
    `);
    console.log('✅ Added location column');
    
    // Add call_number column
    await pool.query(`
      ALTER TABLE books 
      ADD COLUMN IF NOT EXISTS call_number VARCHAR(50)
    `);
    console.log('✅ Added call_number column');
    
    console.log('🎉 Missing columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding columns:', error);
  } finally {
    await pool.end();
  }
}

addMissingColumns(); 