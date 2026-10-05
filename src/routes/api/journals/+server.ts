import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { journals } from '$lib/server/db/schema';
import { desc, sql } from 'drizzle-orm';
import { numeric } from '$lib/server/db/helpers';
import { resolveProjectId } from '$lib/server/project-context';
import { rankVenues } from '$lib/server/venue-analysis';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	if (!projectId) {
		const journalList = await db
			.select({
				id: journals.id,
				name: journals.name,
				issn: journals.issn,
				openalexId: journals.openalexId,
				type: journals.type,
				publisher: journals.publisher,
				createdAt: journals.createdAt,
				paperCount: numeric(sql`(SELECT COUNT(*) FROM paper_journals WHERE journal_id = journals.id)`)
			})
			.from(journals)
			.orderBy(desc(sql`(SELECT COUNT(*) FROM paper_journals WHERE journal_id = journals.id)`));
		return json(journalList.map((j) => ({ ...j, relevanceRank: null, relevanceScore: null })));
	}

	// Ranks are computed per project (journals are shared between projects).
	const ranked = await rankVenues(projectId);
	return json(
		ranked.map((v) => ({
			id: v.venueId,
			name: v.name,
			issn: v.issn,
			openalexId: v.openalexId,
			type: v.type,
			publisher: v.publisher,
			paperCount: v.paperCount,
			relevantPaperCount: v.relevantPaperCount,
			relevanceRank: v.rank,
			relevanceScore: Math.round(v.score * 100) / 100
		}))
	);
};
