import fs from 'fs';
import pool from './database/db.js';

const runMigration = async () => {
  try {
    const migrationFile = fs.readFileSync('./database/revert-user-tables.sql', 'utf8');
    console.log('Running migration to revert user tables...');
    await pool.query(migrationFile);
    console.log('Revert migration completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    pool.end();
  }
};

runMigration(); 