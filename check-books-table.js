import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkBooksTable() {
  try {
    console.log('Checking books table structure...');
    
    // Check table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'books'
      ORDER BY ordinal_position
    `);
    
    console.log('Books table columns:');
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if table has any data
    const countResult = await pool.query('SELECT COUNT(*) as count FROM books');
    console.log(`\nBooks table has ${countResult.rows[0].count} records`);
    
  } catch (error) {
    console.error('❌ Error checking books table:', error);
  } finally {
    await pool.end();
  }
}

checkBooksTable(); 