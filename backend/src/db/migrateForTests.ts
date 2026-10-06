import path from 'path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';

/** Arbitrary stable key so parallel test suites do not race Drizzle migrate. */
const MIGRATE_LOCK_KEY = 87201455;

/**
 * Run Drizzle migrations under a Postgres advisory lock.
 * Needed because node:test can load multiple service suites in parallel and
 * `CREATE TABLE … serial` races on pg_type when two migrators apply at once.
 */
export async function migrateTestDatabase(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_lock(${MIGRATE_LOCK_KEY})`);
  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATE_LOCK_KEY})`);
  }
}
