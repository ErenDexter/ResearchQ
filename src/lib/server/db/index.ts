/**
 * Dialect-aware database client.
 *
 * Default: SQLite via better-sqlite3 (for local/self-hosted use).
 *          DATABASE_URL is interpreted as a filesystem path; defaults to
 *          `./data/researchq.db` relative to process.cwd().
 *
 * Set DB_DIALECT=postgres to use the legacy Postgres path (postgres.js +
 * Neon). In that mode DATABASE_URL must be a Postgres connection string.
 */
import { env } from '$env/dynamic/private';
import { mkdirSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const dialect = env.DB_DIALECT ?? 'sqlite';

type Db = BetterSQLite3Database<typeof schema>;

function createSqliteClient(dbPath: string) {
	const resolved = isAbsolute(dbPath) ? dbPath : resolve(process.cwd(), dbPath);
	mkdirSync(dirname(resolved), { recursive: true });

	const sqlite = new Database(resolved);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');

	return drizzleSqlite(sqlite, { schema });
}

function createPgClient(url: string) {
	const client = postgres(url, { prepare: false });
	return drizzlePg(client, { schema });
}

function createClient() {
	if (dialect === 'postgres') {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set (postgres mode)');
		return createPgClient(env.DATABASE_URL);
	}
	const path = env.DATABASE_URL ?? './data/researchq.db';
	return createSqliteClient(path);
}

// Typed as the SQLite drizzle client (the default dialect) so call sites
// get full query-builder inference. When DB_DIALECT=postgres is set, the
// runtime object is a postgres-js drizzle client instead — the two share
// the same method surface (select/insert/update/delete) and both accept
// the schema tables, so this cast is safe in practice. If you need strict
// pg typing, import from drizzle-orm/postgres-js directly.
export const db = createClient() as Db;
