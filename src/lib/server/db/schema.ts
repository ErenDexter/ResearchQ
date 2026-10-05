/**
 * Dialect-switching schema shim.
 *
 * Selects either the SQLite (default, local/self-hosted) or Postgres (cloud)
 * table definitions at module-load time based on the DB_DIALECT env var.
 *
 * Both schema files define the same table names with identical column shapes,
 * so call sites can import from './schema' and use the active-dialect tables
 * transparently. TypeScript infers the SQLite variant (the default) for type
 * checking; at runtime the correct dialect's tables are exported.
 *
 * For drizzle-kit (migrations), use the dialect-specific files directly:
 *   schema.sqlite.ts — for `pnpm db:push`
 *   schema.pg.ts     — for `pnpm db:push:pg`
 *
 * Keep the two files in sync (same tables, columns and indexes). In the
 * SQLite file, write expression defaults in parentheses — e.g.
 * sql`(CURRENT_TIMESTAMP)` — or drizzle-kit sees a phantom diff on every push.
 */
import { env } from '$env/dynamic/private';
import * as sqliteSchema from './schema.sqlite';
import * as pgSchema from './schema.pg';

const active = (env.DB_DIALECT === 'postgres' ? pgSchema : sqliteSchema) as typeof sqliteSchema;

export const {
	projects,
	projectDimensions,
	journals,
	authors,
	papers,
	paperAuthors,
	keywords,
	projectKeywords,
	paperKeywords,
	paperJournals,
	searchJobs,
	searchCursors,
	jobWorksCache,
	searchPlans,
	searchSteps,
	analysisTags,
	reviewMethodologies,
	methodologyPhases,
	projectReviews,
	reviewPhaseProgress,
	reviewOutputs
} = active;
