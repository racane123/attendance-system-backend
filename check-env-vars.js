import dotenv from 'dotenv';

dotenv.config();

console.log('Environment Variables Check:');
console.log('===========================');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');
console.log('DB_PORT:', process.env.DB_PORT || 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('PORT:', process.env.PORT || 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');

if (!process.env.DATABASE_URL) {
  console.log('\n❌ DATABASE_URL is not set!');
  console.log('Please set your Supabase DATABASE_URL in a .env file');
} else {
  console.log('\n✅ DATABASE_URL is set');
} 