import { Pool } from 'pg';
import 'dotenv/config';

const maxRetries = 20;
const retryInterval = 1000; // 1 second

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

async function waitForDb() {
  let currentTry = 1;

  while (currentTry <= maxRetries) {
    try {
      const client = await pool.connect();
      console.log('Successfully connected to the database');
      client.release();
      process.exit(0);
    } catch (err) {
      console.log(`Attempt ${currentTry}/${maxRetries}: Database not ready yet...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      currentTry++;
    }
  }

  console.error('Could not connect to the database after multiple attempts');
  process.exit(1);
}

waitForDb();
