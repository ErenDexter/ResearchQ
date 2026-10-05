import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { papers } from '$lib/server/db/schema';
import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import { containsInsensitive } from '$lib/server/db/helpers';
import { parsePagination } from '$lib/server/paper-filters';
import { loadPaperRelations } from '$lib/server/paper-relations';
import { resolveProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const { page, limit, offset } = parsePagination(url.searchParams);
	const search = url.searchParams.get('search')?.trim() || '';
	const year = parseInt(url.searchParams.get('year') || '', 10);
	const regionFilter = url.searchParams.get('region')?.trim() || '';
	const relevantOnly = url.searchParams.get('relevant') === 'true';
	const jobId = url.searchParams.get('jobId') || '';
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	const conditions: SQL[] = [];
	if (projectId) conditions.push(eq(papers.projectId, projectId));
	if (search) conditions.push(containsInsensitive(papers.title, search));
	if (Number.isFinite(year)) conditions.push(eq(papers.publicationYear, year));
	if (regionFilter) conditions.push(containsInsensitive(papers.focusedRegion, regionFilter));
	if (relevantOnly) conditions.push(eq(papers.isRelevant, true));
	if (jobId) conditions.push(eq(papers.searchJobId, jobId));

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [paperList, [{ total }]] = await Promise.all([
		db
			.select()
			.from(papers)
			.where(where)
			.orderBy(desc(papers.publicationYear), asc(papers.id))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(papers).where(where)
	]);

	const relations = await loadPaperRelations(
		paperList.map((p) => p.id),
		{ authors: true, keywords: true }
	);

	return json({
		papers: paperList.map((paper) => ({
			...paper,
			authors: (relations.authors.get(paper.id) ?? []).map(({ name, orcid, affiliation }) => ({
				name,
				orcid,
				affiliation
			})),
			keywords: relations.keywords.get(paper.id) ?? []
		})),
		total,
		page,
		limit
	});
};
