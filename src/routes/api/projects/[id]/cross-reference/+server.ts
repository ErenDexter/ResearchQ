import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { papers } from '$lib/server/db/schema';
import { asc, count, desc } from 'drizzle-orm';
import { buildPaperWhere, parsePagination, parsePaperFilters } from '$lib/server/paper-filters';
import { loadPaperRelations } from '$lib/server/paper-relations';

const SORT_COLUMNS = {
	year: papers.publicationYear,
	title: papers.title,
	region: papers.focusedRegion,
	platform: papers.platformDomain,
	created: papers.createdAt
};

export const GET: RequestHandler = async ({ params, url }) => {
	const { page, limit, offset } = parsePagination(url.searchParams);
	const sort = url.searchParams.get('sort') as keyof typeof SORT_COLUMNS | null;
	const sortCol = (sort && SORT_COLUMNS[sort]) || papers.publicationYear;
	const order = url.searchParams.get('order') === 'asc' ? asc(sortCol) : desc(sortCol);

	const where = buildPaperWhere(parsePaperFilters(params.id, url.searchParams));

	const [paperList, [{ total }]] = await Promise.all([
		db.select().from(papers).where(where).orderBy(order, asc(papers.id)).limit(limit).offset(offset),
		db.select({ total: count() }).from(papers).where(where)
	]);

	const relations = await loadPaperRelations(paperList.map((p) => p.id));

	return json({
		papers: paperList.map((p) => ({
			...p,
			authors: (relations.authors.get(p.id) ?? []).map((a) => a.name),
			keywords: relations.keywords.get(p.id) ?? [],
			tags: relations.tags.get(p.id) ?? {},
			publisher: relations.venues.get(p.id)?.publisher ?? null
		})),
		total,
		page,
		limit
	});
};
