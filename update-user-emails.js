import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

async function updateUserEmails() {
  console.log('📧 Updating User Email Addresses...\n');
  
  try {
    // Get current users
    const usersResult = await pool.query('SELECT * FROM users ORDER BY id');
    const users = usersResult.rows;
    
    console.log('Current users:');
    users.forEach(user => {
      console.log(`   - ${user.username}: ${user.email}`);
    });
    
    console.log('\nTo update email addresses, edit this script and uncomment the UPDATE statements below.');
    console.log('Then run: node update-user-emails.js');
    
    // Example UPDATE statements (uncomment and modify as needed):
    /*
    await pool.query("UPDATE users SET email = 'your-real-admin@domain.com' WHERE username = 'admin'");
    await pool.query("UPDATE users SET email = 'your-real-teacher@domain.com' WHERE username = 'teacher'");
    await pool.query("UPDATE users SET email = 'your-real-viewer@domain.com' WHERE username = 'viewer'");
    */
    
    console.log('\n✅ Email update script ready. Edit the file to add your real email addresses.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

updateUserEmails(); 