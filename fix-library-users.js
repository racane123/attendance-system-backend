import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixLibraryUsers() {
  try {
    console.log('Setting up library users...');
    
    // First, check if admin user exists in users table
    const adminUserQuery = 'SELECT id, username, email, role FROM users WHERE username = $1';
    const adminResult = await pool.query(adminUserQuery, ['admin']);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ Admin user not found in users table');
      return;
    }
    
    const adminUser = adminResult.rows[0];
    console.log('✅ Admin user found:', adminUser.username);
    
    // Check if admin exists in library_users table
    const libraryUserQuery = 'SELECT * FROM library_users WHERE user_id = $1';
    const libraryUserResult = await pool.query(libraryUserQuery, [adminUser.id]);
    
    if (libraryUserResult.rows.length === 0) {
      // Create library user for admin
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
      console.log('✅ Library user already exists for admin');
    }
    
    // Create some sample library users for testing
    const sampleUsers = [
      {
        username: 'student1',
        library_card: 'LIB-STU-001',
        name: 'John Student',
        email: 'student1@school.com',
        role: 'student',
        max_books: 3
      },
      {
        username: 'teacher1',
        library_card: 'LIB-TEA-001',
        name: 'Jane Teacher',
        email: 'teacher1@school.com',
        role: 'teacher',
        max_books: 5
      }
    ];
    
    for (const sampleUser of sampleUsers) {
      // Check if user exists in users table
      const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [sampleUser.username]);
      
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Check if library user exists
        const existingLibraryUser = await pool.query('SELECT id FROM library_users WHERE user_id = $1', [userId]);
        
        if (existingLibraryUser.rows.length === 0) {
          await pool.query(`
            INSERT INTO library_users (user_id, library_card_number, name, email, role, max_borrow_limit)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [userId, sampleUser.library_card, sampleUser.name, sampleUser.email, sampleUser.role, sampleUser.max_books]);
          
          console.log(`✅ Created library user for ${sampleUser.username}`);
        }
      }
    }
    
    console.log('🎉 Library users setup completed!');
    
  } catch (error) {
    console.error('❌ Error setting up library users:', error);
  } finally {
    await pool.end();
  }
}

fixLibraryUsers(); 