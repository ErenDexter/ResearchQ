import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authors } from '$lib/server/db/schema';
import { desc, sql, like, and } from 'drizzle-orm';
import { getDefaultProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url }) => {
	const search = url.searchParams.get('search') || '';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());
	const offset = (page - 1) * limit;

	// Use raw column name in subqueries to avoid ambiguity
	const paperCountSubquery = projectId
		? sql<number>`(SELECT COUNT(*) FROM paper_authors pa INNER JOIN papers p ON p.id = pa.paper_id WHERE pa.author_id = authors.id AND p.project_id = ${projectId})`
		: sql<number>`(SELECT COUNT(*) FROM paper_authors WHERE author_id = authors.id)`;

	const conditions = [];
	if (search) {
		conditions.push(like(authors.name, `%${search}%`));
	}
	if (projectId) {
		conditions.push(
			sql`authors.id IN (SELECT pa.author_id FROM paper_authors pa INNER JOIN papers p ON p.id = pa.paper_id WHERE p.project_id = ${projectId})`
		);
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const authorList = await db
		.select({
			id: authors.id,
			name: authors.name,
			orcid: authors.orcid,
			affiliation: authors.affiliation,
			openalexId: authors.openalexId,
			createdAt: authors.createdAt,
			paperCount: paperCountSubquery
		})
		.from(authors)
		.where(whereClause)
		.orderBy(desc(paperCountSubquery))
		.limit(limit)
		.offset(offset);

	const countConditions = [];
	if (search) {
		countConditions.push(like(authors.name, `%${search}%`));
	}
	if (projectId) {
		countConditions.push(
			sql`authors.id IN (SELECT pa.author_id FROM paper_authors pa INNER JOIN papers p ON p.id = pa.paper_id WHERE p.project_id = ${projectId})`
		);
	}
	const countWhere = countConditions.length > 0 ? and(...countConditions) : undefined;
	const countResult = await db.select({ count: sql<number>`count(*)` }).from(authors).where(countWhere);

	return json({
		authors: authorList,
		total: countResult[0]?.count || 0,
		page,
		limit
	});
};
