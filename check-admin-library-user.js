import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkAdminLibraryUser() {
  try {
    console.log('Checking admin user in library_users table...');
    
    // First, get the admin user from users table
    const adminUserQuery = 'SELECT id, username, email FROM users WHERE username = $1';
    const adminResult = await pool.query(adminUserQuery, ['admin']);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ Admin user not found in users table');
      return;
    }
    
    const adminUser = adminResult.rows[0];
    console.log('✅ Admin user found:', adminUser);
    
    // Check if admin exists in library_users table
    const libraryUserQuery = 'SELECT * FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [adminUser.id]);
    
    if (libraryUserResult.rows.length === 0) {
      console.log('❌ Admin user not found in library_users table');
      console.log('Creating library user for admin...');
      
      const createLibraryUserQuery = `
        INSERT INTO library_users (user_id, library_card_number, name, email, role, max_borrow_limit)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await pool.query(createLibraryUserQuery, [
        adminUser.id,
        'LIB-ADMIN-001',
        adminUser.username,
        adminUser.email || 'admin@library.com',
        'librarian',
        10
      ]);
      
      console.log('✅ Created library user for admin');
    } else {
      console.log('✅ Admin user found in library_users table:', libraryUserResult.rows[0]);
    }
    
    // Test the borrowings query
    console.log('\nTesting borrowings query...');
    const borrowingsQuery = `
      SELECT 
        b.*,
        bk.title, bk.author, bk.isbn, bk.cover_image_url,
        bc.copy_number,
        lu.name as user_name
      FROM borrowings b
      JOIN book_copies bc ON b.book_copy_id = bc.id
      JOIN books bk ON bc.book_id = bk.id
      JOIN library_users lu ON b.user_id = lu.id
      WHERE b.user_id = $1
      ORDER BY b.borrowed_at DESC
    `;
    
    const borrowingsResult = await pool.query(borrowingsQuery, [adminUser.id]);
    console.log(`✅ Borrowings query successful: ${borrowingsResult.rows.length} borrowings found`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAdminLibraryUser(); 