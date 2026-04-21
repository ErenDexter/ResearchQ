import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { papers, analysisTags, projectDimensions } from '$lib/server/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { getDefaultProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());

	const projectFilter = projectId ? eq(papers.projectId, projectId) : undefined;
	const relevantFilter = eq(papers.isRelevant, true);
	const baseWhere = projectFilter ? and(relevantFilter, projectFilter) : relevantFilter;

	// Papers by year
	const byYear = await db
		.select({
			year: papers.publicationYear,
			count: sql<number>`count(*)`
		})
		.from(papers)
		.where(baseWhere)
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	// Papers by region
	const byRegion = await db
		.select({
			region: papers.focusedRegion,
			count: sql<number>`count(*)`
		})
		.from(papers)
		.where(and(baseWhere, sql`${papers.focusedRegion} IS NOT NULL`))
		.groupBy(papers.focusedRegion)
		.orderBy(sql`count(*) DESC`)
		.limit(20);

	// Papers by platform domain
	const byPlatform = await db
		.select({
			platform: papers.platformDomain,
			count: sql<number>`count(*)`
		})
		.from(papers)
		.where(and(baseWhere, sql`${papers.platformDomain} IS NOT NULL`))
		.groupBy(papers.platformDomain)
		.orderBy(sql`count(*) DESC`);

	// Analysis tags distribution (scoped to project papers)
	const tagWhere = projectId
		? sql`${analysisTags.paperId} IN (SELECT id FROM papers WHERE project_id = ${projectId})`
		: undefined;

	const tagDistribution = await db
		.select({
			dimension: analysisTags.dimension,
			value: analysisTags.value,
			count: sql<number>`count(*)`
		})
		.from(analysisTags)
		.where(tagWhere)
		.groupBy(analysisTags.dimension, analysisTags.value)
		.orderBy(analysisTags.dimension, sql`count(*) DESC`);

	// Load project dimensions for dynamic framework
	let dimensions: { name: string; label: string; description: string | null }[] = [];
	if (projectId) {
		dimensions = await db
			.select({
				name: projectDimensions.name,
				label: projectDimensions.label,
				description: projectDimensions.description
			})
			.from(projectDimensions)
			.where(eq(projectDimensions.projectId, projectId))
			.orderBy(projectDimensions.position);
	}

	// Total stats
	const allPapersWhere = projectFilter || undefined;
	const totalPapers = (
		await db.select({ count: sql<number>`count(*)` }).from(papers).where(allPapersWhere)
	)[0]?.count || 0;
	const relevantPapers = (
		await db.select({ count: sql<number>`count(*)` }).from(papers).where(baseWhere)
	)[0]?.count || 0;

	return json({
		totalPapers,
		relevantPapers,
		byYear,
		byRegion,
		byPlatform,
		tagDistribution,
		dimensions
	});
};
