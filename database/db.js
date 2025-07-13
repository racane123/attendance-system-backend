import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
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