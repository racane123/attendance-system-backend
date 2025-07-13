import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function createDatabase() {
  // Connect to default postgres database to create our database
  const defaultPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres', // Connect to default database
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    console.log('Creating database...');
    
    // Check if database already exists
    const checkResult = await defaultPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME]
    );

    if (checkResult.rows.length === 0) {
      // Create database
      await defaultPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`Database '${process.env.DB_NAME}' created successfully!`);
    } else {
      console.log(`Database '${process.env.DB_NAME}' already exists.`);
    }
  } catch (error) {
    console.error('Error creating database:', error);
  } finally {
    await defaultPool.end();
  }
}

createDatabase(); 