/**
 * Venue Intelligence — analyze and rank journals/conferences for a project.
 *
 * Journals are shared between projects, so ranks are computed per project at
 * read time rather than stored on the journal row.
 */

import { db } from './db';
import {
	papers,
	journals,
	paperJournals,
	paperAuthors,
	authors
} from './db/schema';
import { countDistinct, desc, eq, sql } from 'drizzle-orm';
import { numeric } from './db/helpers';

export type VenueRank = 'core' | 'relevant' | 'peripheral';

export interface RankedVenue {
	venueId: string;
	name: string;
	issn: string | null;
	openalexId: string | null;
	type: string | null;
	publisher: string | null;
	paperCount: number;
	relevantPaperCount: number;
	rank: VenueRank;
	score: number;
}

export interface VenueAnalysis extends RankedVenue {
	topAuthors: { name: string; paperCount: number }[];
	focusAreas: string[];
}

/** Simple scoring: normalized paper volume (40%) + share of relevant papers (60%). */
export function scoreVenue(
	paperCount: number,
	relevantPaperCount: number,
	maxPaperCount: number
): { score: number; rank: VenueRank } {
	const relevanceRatio = relevantPaperCount / Math.max(paperCount, 1);
	const volumeScore = paperCount / Math.max(maxPaperCount, 1);
	const score = volumeScore * 0.4 + relevanceRatio * 0.6;

	let rank: VenueRank;
	if (score >= 0.5 || relevantPaperCount >= 5) rank = 'core';
	else if (score >= 0.2 || relevantPaperCount >= 2) rank = 'relevant';
	else rank = 'peripheral';

	return { score, rank };
}

export async function rankVenues(projectId: string): Promise<RankedVenue[]> {
	const venueStats = await db
		.select({
			journalId: journals.id,
			journalName: journals.name,
			issn: journals.issn,
			openalexId: journals.openalexId,
			type: journals.type,
			publisher: journals.publisher,
			totalPapers: countDistinct(papers.id),
			relevantPapers: numeric(sql`SUM(CASE WHEN ${papers.isRelevant} THEN 1 ELSE 0 END)`)
		})
		.from(paperJournals)
		.innerJoin(journals, eq(paperJournals.journalId, journals.id))
		.innerJoin(papers, eq(paperJournals.paperId, papers.id))
		.where(eq(papers.projectId, projectId))
		.groupBy(journals.id)
		.orderBy(desc(countDistinct(papers.id)), journals.name);

	const maxPapers = venueStats[0]?.totalPapers || 1;

	return venueStats.map((venue) => {
		const relevant = venue.relevantPapers || 0;
		const { score, rank } = scoreVenue(venue.totalPapers, relevant, maxPapers);
		return {
			venueId: venue.journalId,
			name: venue.journalName,
			issn: venue.issn,
			openalexId: venue.openalexId,
			type: venue.type,
			publisher: venue.publisher,
			paperCount: venue.totalPapers,
			relevantPaperCount: relevant,
			rank,
			score
		};
	});
}

export async function analyzeVenues(projectId: string): Promise<VenueAnalysis[]> {
	const ranked = await rankVenues(projectId);
	if (ranked.length === 0) return [];

	// Top authors per venue in one query, then trimmed to 5 per venue.
	const authorRows = await db
		.select({
			journalId: paperJournals.journalId,
			name: authors.name,
			paperCount: countDistinct(papers.id)
		})
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
		.innerJoin(paperJournals, eq(paperJournals.paperId, papers.id))
		.where(eq(papers.projectId, projectId))
		.groupBy(paperJournals.journalId, authors.id)
		.orderBy(desc(countDistinct(papers.id)));

	const topAuthors = new Map<string, { name: string; paperCount: number }[]>();
	for (const row of authorRows) {
		const list = topAuthors.get(row.journalId) ?? [];
		if (list.length < 5) list.push({ name: row.name, paperCount: row.paperCount });
		topAuthors.set(row.journalId, list);
	}

	return ranked.map((venue) => ({
		...venue,
		topAuthors: topAuthors.get(venue.venueId) ?? [],
		focusAreas: [] // Could be LLM-enriched in the future
	}));
}
