/**
 * Test database helpers: build the real SQLite schema (from schema.sqlite.ts,
 * via drizzle-kit's programmatic API) and insert fixture rows.
 */
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api';
import * as sqliteSchema from '$lib/server/db/schema.sqlite';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { keywords, papers, projectKeywords, projects } from '$lib/server/db/schema';

export async function createSchema(): Promise<void> {
	const empty = await generateSQLiteDrizzleJson({});
	const current = await generateSQLiteDrizzleJson(sqliteSchema as Record<string, unknown>);
	const statements = await generateSQLiteMigration(empty, current);
	const client = (db as unknown as { $client: { exec(sql: string): void } }).$client;
	for (const statement of statements) client.exec(statement);
}

export async function createProject(
	name = 'Test project',
	terms: string[] = ['auditing']
): Promise<string> {
	const [project] = await db
		.insert(projects)
		.values({ name, description: `${name} description` })
		.returning();
	for (const term of terms) {
		await db.insert(keywords).values({ term }).onConflictDoNothing();
		const [kw] = await db.select().from(keywords).where(eq(keywords.term, term));
		await db
			.insert(projectKeywords)
			.values({ projectId: project.id, keywordId: kw.id, isBaseKeyword: true });
	}
	return project.id;
}

export async function insertPaper(
	projectId: string,
	values: Partial<typeof papers.$inferInsert> = {}
): Promise<string> {
	const [paper] = await db
		.insert(papers)
		.values({ projectId, title: 'A paper', ...values })
		.returning({ id: papers.id });
	return paper.id;
}
