import { db } from '$lib/server/db';
import { papers, searchJobs, journals, authors, keywords } from '$lib/server/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [totalPapers] = await db.select({ count: sql<number>`count(*)` }).from(papers);
	const [relevantPapers] = await db
		.select({ count: sql<number>`count(*)` })
		.from(papers)
		.where(eq(papers.isRelevant, true));
	const [totalJournals] = await db.select({ count: sql<number>`count(*)` }).from(journals);
	const [totalAuthors] = await db.select({ count: sql<number>`count(*)` }).from(authors);
	const [totalKeywords] = await db.select({ count: sql<number>`count(*)` }).from(keywords);

	const recentJobs = await db
		.select()
		.from(searchJobs)
		.orderBy(desc(searchJobs.createdAt))
		.limit(5);

	const recentPapers = await db
		.select({
			id: papers.id,
			title: papers.title,
			publicationYear: papers.publicationYear,
			focusedRegion: papers.focusedRegion,
			platformDomain: papers.platformDomain,
			isRelevant: papers.isRelevant
		})
		.from(papers)
		.where(eq(papers.isRelevant, true))
		.orderBy(desc(papers.createdAt))
		.limit(8);

	const byYear = await db
		.select({
			year: papers.publicationYear,
			count: sql<number>`count(*)`
		})
		.from(papers)
		.where(eq(papers.isRelevant, true))
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	return {
		stats: {
			totalPapers: totalPapers?.count || 0,
			relevantPapers: relevantPapers?.count || 0,
			totalJournals: totalJournals?.count || 0,
			totalAuthors: totalAuthors?.count || 0,
			totalKeywords: totalKeywords?.count || 0
		},
		recentJobs,
		recentPapers,
		byYear
	};
};
