import { db } from '$lib/server/db';
import {
	papers,
	searchJobs,
	paperJournals,
	paperAuthors,
	projectKeywords
} from '$lib/server/db/schema';
import { and, count, countDistinct, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { currentProjectId } = await parent();
	const projectId = currentProjectId ?? '';

	// Everything on the dashboard is scoped to the project selected in the sidebar.
	const inProject = eq(papers.projectId, projectId);
	const relevantInProject = and(inProject, eq(papers.isRelevant, true));

	const [
		[{ totalPapers }],
		[{ relevantPapers }],
		[{ totalJournals }],
		[{ totalAuthors }],
		[{ totalKeywords }]
	] = await Promise.all([
		db.select({ totalPapers: count() }).from(papers).where(inProject),
		db.select({ relevantPapers: count() }).from(papers).where(relevantInProject),
		db
			.select({ totalJournals: countDistinct(paperJournals.journalId) })
			.from(paperJournals)
			.innerJoin(papers, eq(papers.id, paperJournals.paperId))
			.where(inProject),
		db
			.select({ totalAuthors: countDistinct(paperAuthors.authorId) })
			.from(paperAuthors)
			.innerJoin(papers, eq(papers.id, paperAuthors.paperId))
			.where(inProject),
		db
			.select({ totalKeywords: count() })
			.from(projectKeywords)
			.where(eq(projectKeywords.projectId, projectId))
	]);

	const recentJobs = await db
		.select()
		.from(searchJobs)
		.where(eq(searchJobs.projectId, projectId))
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
		.where(relevantInProject)
		.orderBy(desc(papers.createdAt))
		.limit(8);

	const byYear = await db
		.select({
			year: papers.publicationYear,
			count: count()
		})
		.from(papers)
		.where(relevantInProject)
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	return {
		stats: {
			totalPapers,
			relevantPapers,
			totalJournals,
			totalAuthors,
			totalKeywords
		},
		recentJobs,
		recentPapers,
		byYear
	};
};
