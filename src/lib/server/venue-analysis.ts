/**
 * Venue Intelligence — analyze and rank journals/conferences for a project.
 */

import { db } from './db';
import {
	papers,
	journals,
	paperJournals,
	paperAuthors,
	authors
} from './db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export interface VenueAnalysis {
	venueId: string;
	name: string;
	paperCount: number;
	relevantPaperCount: number;
	topAuthors: { name: string; paperCount: number }[];
	rank: 'core' | 'relevant' | 'peripheral';
	focusAreas: string[];
	score: number;
}

export async function analyzeVenues(projectId: string): Promise<VenueAnalysis[]> {
	// Get all journals with papers in this project
	const venueStats = await db
		.select({
			journalId: journals.id,
			journalName: journals.name,
			totalPapers: sql<number>`COUNT(DISTINCT ${papers.id})`,
			relevantPapers: sql<number>`SUM(CASE WHEN ${papers.isRelevant} = 1 THEN 1 ELSE 0 END)`
		})
		.from(paperJournals)
		.innerJoin(journals, eq(paperJournals.journalId, journals.id))
		.innerJoin(papers, eq(paperJournals.paperId, papers.id))
		.where(eq(papers.projectId, projectId))
		.groupBy(journals.id)
		.orderBy(desc(sql`COUNT(DISTINCT ${papers.id})`));

	if (venueStats.length === 0) return [];

	const results: VenueAnalysis[] = [];
	const maxPapers = venueStats[0]?.totalPapers || 1;

	for (const venue of venueStats) {
		// Get top authors for this venue in this project
		const topAuthors = await db
			.select({
				name: authors.name,
				paperCount: sql<number>`COUNT(DISTINCT ${papers.id})`
			})
			.from(paperAuthors)
			.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
			.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
			.innerJoin(paperJournals, eq(paperJournals.paperId, papers.id))
			.where(
				and(
					eq(paperJournals.journalId, venue.journalId),
					eq(papers.projectId, projectId)
				)
			)
			.groupBy(authors.id)
			.orderBy(desc(sql`COUNT(DISTINCT ${papers.id})`))
			.limit(5);

		// Simple scoring: normalized paper count * relevance ratio
		const relevanceRatio = venue.relevantPapers / Math.max(venue.totalPapers, 1);
		const volumeScore = venue.totalPapers / maxPapers;
		const score = (volumeScore * 0.4 + relevanceRatio * 0.6);

		let rank: 'core' | 'relevant' | 'peripheral';
		if (score >= 0.5 || venue.relevantPapers >= 5) {
			rank = 'core';
		} else if (score >= 0.2 || venue.relevantPapers >= 2) {
			rank = 'relevant';
		} else {
			rank = 'peripheral';
		}

		// Update journal record
		await db
			.update(journals)
			.set({
				relevanceRank: rank,
				relevanceScore: Math.round(score * 100) / 100
			})
			.where(eq(journals.id, venue.journalId));

		results.push({
			venueId: venue.journalId,
			name: venue.journalName,
			paperCount: venue.totalPapers,
			relevantPaperCount: venue.relevantPapers,
			topAuthors: topAuthors.map((a) => ({ name: a.name, paperCount: a.paperCount })),
			rank,
			focusAreas: [], // Could be LLM-enriched in the future
			score
		});
	}

	return results;
}
