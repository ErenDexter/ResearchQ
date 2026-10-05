import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { authors } from '$lib/server/db/schema';
import { and, count, desc, sql, type SQL } from 'drizzle-orm';
import { containsInsensitive, numeric } from '$lib/server/db/helpers';
import { parsePagination } from '$lib/server/paper-filters';
import { resolveProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const search = url.searchParams.get('search')?.trim() || '';
	const { page, limit, offset } = parsePagination(url.searchParams);
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	// Use raw column name in subqueries to avoid ambiguity
	const paperCountSubquery = numeric(
		projectId
			? sql`(SELECT COUNT(*) FROM paper_authors pa INNER JOIN papers p ON p.id = pa.paper_id WHERE pa.author_id = authors.id AND p.project_id = ${projectId})`
			: sql`(SELECT COUNT(*) FROM paper_authors WHERE author_id = authors.id)`
	);

	const conditions: SQL[] = [];
	if (search) {
		conditions.push(containsInsensitive(authors.name, search));
	}
	if (projectId) {
		conditions.push(
			sql`authors.id IN (SELECT pa.author_id FROM paper_authors pa INNER JOIN papers p ON p.id = pa.paper_id WHERE p.project_id = ${projectId})`
		);
	}
	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const [authorList, [{ total }]] = await Promise.all([
		db
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
			.orderBy(desc(paperCountSubquery), authors.name)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(authors).where(whereClause)
	]);

	return json({
		authors: authorList,
		total,
		page,
		limit
	});
};
