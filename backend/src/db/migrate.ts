require('dotenv').config();
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

const db = drizzle(pool);

async function main() {
  console.log('Running migrations...');
  // Use absolute path for migrations folder
  const migrationsPath = path.join(process.cwd(), 'drizzle');
  console.log(`Looking for migrations in: ${migrationsPath}`);
  
  await migrate(db, { migrationsFolder: migrationsPath });
  console.log('Migrations complete!');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
