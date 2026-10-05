import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { papers, analysisTags, projectDimensions } from '$lib/server/db/schema';
import { eq, sql, and, count, desc, isNotNull, inArray } from 'drizzle-orm';
import { resolveProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	const projectFilter = projectId ? eq(papers.projectId, projectId) : undefined;
	const baseWhere = and(eq(papers.isRelevant, true), projectFilter);

	// Papers by year
	const byYear = await db
		.select({
			year: papers.publicationYear,
			count: count()
		})
		.from(papers)
		.where(baseWhere)
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	// Papers by region
	const byRegion = await db
		.select({
			region: papers.focusedRegion,
			count: count()
		})
		.from(papers)
		.where(and(baseWhere, isNotNull(papers.focusedRegion)))
		.groupBy(papers.focusedRegion)
		.orderBy(desc(count()))
		.limit(20);

	// Papers by platform domain
	const byPlatform = await db
		.select({
			platform: papers.platformDomain,
			count: count()
		})
		.from(papers)
		.where(and(baseWhere, isNotNull(papers.platformDomain)))
		.groupBy(papers.platformDomain)
		.orderBy(desc(count()));

	// Analysis tags distribution (scoped to project papers)
	const tagWhere = projectId
		? inArray(
				analysisTags.paperId,
				db.select({ id: papers.id }).from(papers).where(eq(papers.projectId, projectId))
			)
		: undefined;

	const tagDistribution = await db
		.select({
			dimension: analysisTags.dimension,
			value: analysisTags.value,
			count: count()
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
	const [[{ totalPapers }], [{ relevantPapers }]] = await Promise.all([
		db.select({ totalPapers: count() }).from(papers).where(projectFilter),
		db.select({ relevantPapers: count() }).from(papers).where(baseWhere)
	]);

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
