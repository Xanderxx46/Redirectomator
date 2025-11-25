import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as schema from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize SQLite database
const sqlite = new Database(join(__dirname, '..', '..', 'invites.db'));

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Initialize Drizzle
export const db = drizzle(sqlite, { schema });

// Run migrations (creates tables if they don't exist)
// Note: For initial setup, we'll create tables manually in database.ts
// Migrations can be added later with drizzle-kit

export default db;

