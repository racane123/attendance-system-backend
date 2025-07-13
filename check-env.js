import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Checking DATABASE_URL format...');

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.log('❌ DATABASE_URL is not set');
  process.exit(1);
}

// Mask the password for security
const maskedUrl = dbUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');

console.log('Current DATABASE_URL format:');
console.log(maskedUrl);

// Check if it has the correct Supabase format
if (dbUrl.includes('db.') && dbUrl.includes('.supabase.co')) {
  console.log('✅ Format looks correct for Supabase');
} else {
  console.log('❌ Format may be incorrect for Supabase');
  console.log('Expected format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
}

console.log('\n🔧 To fix:');
console.log('1. Go to Supabase Dashboard → Settings → Database');
console.log('2. Copy the URI connection string');
console.log('3. Update your .env file'); 