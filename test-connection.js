import dotenv from 'dotenv';
import pool from './database/db.js';

dotenv.config();

console.log('🔍 Testing Supabase Database Connection...');
console.log('Environment variables:');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('DATABASE_URL in use:', process.env.DATABASE_URL); // <-- Added for debugging

async function testConnection() {
  try {
    console.log('\n🔄 Attempting to connect to database...');
    
    // Test the connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log('Current database time:', result.rows[0].current_time);
    
    // Test if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('\n📋 Existing tables:');
    if (tablesResult.rows.length === 0) {
      console.log('No tables found. Database is empty.');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('1. Check your DATABASE_URL in .env file');
    console.error('2. Verify your Supabase credentials');
    console.error('3. Make sure your Supabase project is active');
  } finally {
    await pool.end();
  }
}

testConnection(); 