import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixBorrowingsTable() {
  try {
    console.log('Checking borrowings table structure...');
    
    // Check current table structure
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'borrowings'
      ORDER BY ordinal_position
    `);
    
    console.log('Current borrowings table columns:');
    columnsResult.rows.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Add missing columns if they don't exist
    const missingColumns = [
      {
        name: 'book_copy_id',
        type: 'INTEGER',
        constraint: 'REFERENCES book_copies(id) ON DELETE CASCADE'
      },
      {
        name: 'due_date',
        type: 'TIMESTAMP',
        constraint: 'NOT NULL'
      },
      {
        name: 'returned_at',
        type: 'TIMESTAMP',
        constraint: ''
      },
      {
        name: 'fine_amount',
        type: 'DECIMAL(10,2)',
        constraint: 'DEFAULT 0.00'
      },
      {
        name: 'notes',
        type: 'TEXT',
        constraint: ''
      }
    ];
    
    for (const column of missingColumns) {
      const columnExists = columnsResult.rows.some(col => col.column_name === column.name);
      
      if (!columnExists) {
        const addColumnQuery = `
          ALTER TABLE borrowings 
          ADD COLUMN ${column.name} ${column.type} ${column.constraint}
        `;
        
        await pool.query(addColumnQuery);
        console.log(`✅ Added column: ${column.name}`);
      } else {
        console.log(`⚠️ Column already exists: ${column.name}`);
      }
    }
    
    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_borrowings_user_id ON borrowings(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_borrowings_status ON borrowings(status)',
      'CREATE INDEX IF NOT EXISTS idx_borrowings_due_date ON borrowings(due_date)',
      'CREATE INDEX IF NOT EXISTS idx_borrowings_book_copy_id ON borrowings(book_copy_id)'
    ];
    
    for (const index of indexes) {
      await pool.query(index);
    }
    console.log('✅ Indexes created');
    
    console.log('🎉 Borrowings table fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing borrowings table:', error);
  } finally {
    await pool.end();
  }
}

fixBorrowingsTable(); 