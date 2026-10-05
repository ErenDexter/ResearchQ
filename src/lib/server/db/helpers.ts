/**
 * Dialect-neutral SQL helpers.
 *
 * The app runs on SQLite (default) or Postgres with the same query code, so
 * anything that differs between the two lives here:
 *
 * - Aggregates: Postgres returns COUNT/SUM as bigint/numeric, which postgres.js
 *   hands back as *strings*. Always map them to numbers (drizzle's `count()`
 *   helper already does; use `numeric()` for raw aggregate expressions).
 * - Case-insensitive matching: SQLite has no ILIKE and Postgres LIKE is
 *   case-sensitive, so compare lower() on both sides instead.
 */
import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/** Wrap a raw aggregate/subquery expression so it always comes back as a JS number. */
export function numeric(expression: SQL): SQL<number> {
	return expression.mapWith(Number);
}

/** Escape LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Case-insensitive "column contains value" that works on SQLite and Postgres. */
export function containsInsensitive(column: SQLWrapper, value: string): SQL {
	return sql`lower(${column}) like ${`%${escapeLike(value.toLowerCase())}%`} escape '\\'`;
}

/** Split a list into chunks so IN (...) lists stay well under driver parameter limits. */
export function chunk<T>(items: T[], size = 500): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}
