import { defineConfig } from 'drizzle-kit';
import { mkdirSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';

const dialect = process.env.DB_DIALECT ?? 'sqlite';

if (dialect !== 'postgres') {
	const dbPath = process.env.DATABASE_URL ?? './data/researchq.db';
	const resolved = isAbsolute(dbPath) ? dbPath : resolve(process.cwd(), dbPath);
	mkdirSync(dirname(resolved), { recursive: true });
}

export default dialect === 'postgres'
	? defineConfig({
			schema: './src/lib/server/db/schema.pg.ts',
			dialect: 'postgresql',
			out: './drizzle/pg',
			dbCredentials: {
				url: (() => {
					if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (postgres mode)');
					return process.env.DATABASE_URL;
				})()
			},
			verbose: true,
			strict: true
		})
	: defineConfig({
			schema: './src/lib/server/db/schema.sqlite.ts',
			dialect: 'sqlite',
			out: './drizzle/sqlite',
			dbCredentials: {
				url: process.env.DATABASE_URL ?? './data/researchq.db'
			},
			verbose: true,
			strict: true
		});
