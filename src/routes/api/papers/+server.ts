import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { papers, paperAuthors, authors, paperKeywords, keywords } from '$lib/server/db/schema';
import { eq, desc, like, and, sql } from 'drizzle-orm';
import { getDefaultProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const search = url.searchParams.get('search') || '';
	const yearFilter = url.searchParams.get('year') || '';
	const regionFilter = url.searchParams.get('region') || '';
	const relevantOnly = url.searchParams.get('relevant') === 'true';
	const jobId = url.searchParams.get('jobId') || '';
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());
	const offset = (page - 1) * limit;

	const conditions = [];

	if (projectId) {
		conditions.push(eq(papers.projectId, projectId));
	}
	if (search) {
		conditions.push(like(papers.title, `%${search}%`));
	}
	if (yearFilter) {
		conditions.push(eq(papers.publicationYear, parseInt(yearFilter)));
	}
	if (regionFilter) {
		conditions.push(like(papers.focusedRegion, `%${regionFilter}%`));
	}
	if (relevantOnly) {
		conditions.push(eq(papers.isRelevant, true));
	}
	if (jobId) {
		conditions.push(eq(papers.searchJobId, jobId));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [paperList, countResult] = await Promise.all([
		db
			.select()
			.from(papers)
			.where(where)
			.orderBy(desc(papers.publicationYear))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)` })
			.from(papers)
			.where(where)
	]);

	// Enrich with authors and keywords
	const enriched = await Promise.all(
		paperList.map(async (paper) => {
			const [authorList, keywordList] = await Promise.all([
				db
					.select({
						name: authors.name,
						orcid: authors.orcid,
						affiliation: authors.affiliation
					})
					.from(paperAuthors)
					.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
					.where(eq(paperAuthors.paperId, paper.id))
					.orderBy(paperAuthors.position),
				db
					.select({ term: keywords.term })
					.from(paperKeywords)
					.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
					.where(eq(paperKeywords.paperId, paper.id))
			]);

			return {
				...paper,
				authors: authorList,
				keywords: keywordList.map((k) => k.term)
			};
		})
	);

	return json({
		papers: enriched,
		total: countResult[0]?.count || 0,
		page,
		limit
	});
};
