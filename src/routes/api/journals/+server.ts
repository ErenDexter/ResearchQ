import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { journals } from '$lib/server/db/schema';
import { desc, sql } from 'drizzle-orm';
import { getDefaultProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());

	// Use raw column name in subqueries to avoid ambiguity
	const paperCountSubquery = projectId
		? sql<number>`(SELECT COUNT(*) FROM paper_journals pj INNER JOIN papers p ON p.id = pj.paper_id WHERE pj.journal_id = journals.id AND p.project_id = ${projectId})`
		: sql<number>`(SELECT COUNT(*) FROM paper_journals WHERE journal_id = journals.id)`;

	const journalList = await db
		.select({
			id: journals.id,
			name: journals.name,
			issn: journals.issn,
			openalexId: journals.openalexId,
			type: journals.type,
			publisher: journals.publisher,
			relevanceRank: journals.relevanceRank,
			relevanceScore: journals.relevanceScore,
			focusAreas: journals.focusAreas,
			createdAt: journals.createdAt,
			paperCount: paperCountSubquery
		})
		.from(journals)
		.orderBy(desc(paperCountSubquery));

	// Filter out journals with 0 papers for this project
	const filtered = projectId
		? journalList.filter((j) => j.paperCount > 0)
		: journalList;

	return json(filtered);
};
