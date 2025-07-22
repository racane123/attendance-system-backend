import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

let pool;

// Check if DATABASE_URL is provided (Supabase format)
if (process.env.DATABASE_URL) {
  console.log(`Connecting to Supabase database...${process.env.DATABASE_URL}`);
  // Use the connection string directly
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Supabase
    }
  });
} else {
  console.log('Connecting to local database...');
  // Fallback to individual environment variables
  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
}

// Add an error listener to the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // You might want to decide whether to close the client or let the pool handle it.
  // For now, we'll just log it. In a production environment, you might need more robust handling.
});

export default pool;

// Debug: Print all users and their roles
if (process.env.DEBUG_USERS === 'true') {
  (async () => {
    const result = await pool.query('SELECT id, username, email, role FROM users');
    console.log('Users:', result.rows);
    process.exit(0);
  })();
} 