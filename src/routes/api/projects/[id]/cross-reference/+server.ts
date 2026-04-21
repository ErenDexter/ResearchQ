import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	papers,
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	analysisTags,
	paperJournals,
	journals
} from '$lib/server/db/schema';
import { eq, and, desc, sql, like } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params, url }) => {
	const projectId = params.id;
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = (page - 1) * limit;
	const sort = url.searchParams.get('sort') || 'year';
	const order = url.searchParams.get('order') || 'desc';
	const search = url.searchParams.get('search') || '';
	const yearMin = url.searchParams.get('yearMin');
	const yearMax = url.searchParams.get('yearMax');
	const region = url.searchParams.get('region');
	const platform = url.searchParams.get('platform');
	const database = url.searchParams.get('database'); // publisher filter
	const keyword = url.searchParams.get('keyword');
	const relevantOnly = url.searchParams.get('relevant') === 'true';

	const conditions = [eq(papers.projectId, projectId)];

	if (relevantOnly) conditions.push(eq(papers.isRelevant, true));
	if (search) conditions.push(like(papers.title, `%${search}%`));
	if (yearMin) conditions.push(sql`${papers.publicationYear} >= ${parseInt(yearMin)}`);
	if (yearMax) conditions.push(sql`${papers.publicationYear} <= ${parseInt(yearMax)}`);
	if (region) conditions.push(like(papers.focusedRegion, `%${region}%`));
	if (platform) conditions.push(like(papers.platformDomain, `%${platform}%`));

	// Filter by database/publisher (joins papers → paperJournals → journals)
	if (database) {
		conditions.push(sql`${papers.id} IN (
			SELECT pj.paper_id FROM paper_journals pj
			INNER JOIN journals j ON j.id = pj.journal_id
			WHERE j.publisher ILIKE ${'%' + database + '%'}
		)`);
	}

	// Filter by keyword (joins papers → paperKeywords → keywords)
	if (keyword) {
		conditions.push(sql`${papers.id} IN (
			SELECT pk.paper_id FROM paper_keywords pk
			INNER JOIN keywords k ON k.id = pk.keyword_id
			WHERE k.term ILIKE ${'%' + keyword + '%'}
		)`);
	}

	const where = and(...conditions);

	// Sort mapping
	const sortColumns: Record<string, any> = {
		year: papers.publicationYear,
		title: papers.title,
		region: papers.focusedRegion,
		platform: papers.platformDomain,
		created: papers.createdAt
	};
	const sortCol = sortColumns[sort] || papers.publicationYear;
	const orderFn = order === 'asc' ? sortCol : desc(sortCol);

	const [paperList, countResult] = await Promise.all([
		db.select().from(papers).where(where).orderBy(orderFn).limit(limit).offset(offset),
		db.select({ count: sql<number>`count(*)` }).from(papers).where(where)
	]);

	// Enrich each paper
	const enriched = await Promise.all(
		paperList.map(async (p) => {
			const [authorList, kwList, tagList, journalInfo] = await Promise.all([
				db
					.select({ name: authors.name })
					.from(paperAuthors)
					.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
					.where(eq(paperAuthors.paperId, p.id))
					.orderBy(paperAuthors.position),
				db
					.select({ term: keywords.term })
					.from(paperKeywords)
					.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
					.where(eq(paperKeywords.paperId, p.id)),
				db
					.select({ dimension: analysisTags.dimension, value: analysisTags.value })
					.from(analysisTags)
					.where(eq(analysisTags.paperId, p.id)),
				db
					.select({ publisher: journals.publisher })
					.from(paperJournals)
					.innerJoin(journals, eq(paperJournals.journalId, journals.id))
					.where(eq(paperJournals.paperId, p.id))
					.limit(1)
			]);

			const tags: Record<string, string> = {};
			for (const t of tagList) {
				tags[t.dimension] = t.value;
			}

			return {
				...p,
				authors: authorList.map((a) => a.name),
				keywords: kwList.map((k) => k.term),
				tags,
				publisher: journalInfo[0]?.publisher || null
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
