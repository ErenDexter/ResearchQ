/**
 * Research Intelligence — gap analysis, trends, author networks, duplicates.
 */

import { generateText } from 'ai';
import { getModel } from './llm';
import { db } from './db';
import {
	papers,
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	analysisTags
} from './db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { loadPromptContext } from './project-context';

// ─── Author Network ────────────────────────────────────────────────

export interface AuthorStats {
	id: string;
	name: string;
	affiliation: string | null;
	paperCount: number;
	topKeywords: string[];
}

export interface CoAuthorPair {
	author1: string;
	author2: string;
	sharedPapers: number;
}

export async function analyzeAuthorNetwork(projectId: string) {
	// Prolific authors
	const prolificAuthors = await db
		.select({
			id: authors.id,
			name: authors.name,
			affiliation: authors.affiliation,
			paperCount: sql<number>`COUNT(DISTINCT ${papers.id})`
		})
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(authors.id)
		.orderBy(desc(sql`COUNT(DISTINCT ${papers.id})`))
		.limit(20);

	// Get top keywords for each prolific author
	const authorStats: AuthorStats[] = await Promise.all(
		prolificAuthors.map(async (a) => {
			const topKws = await db
				.select({ term: keywords.term, count: sql<number>`COUNT(*)` })
				.from(paperKeywords)
				.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
				.innerJoin(paperAuthors, eq(paperAuthors.paperId, paperKeywords.paperId))
				.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
				.where(
					and(
						eq(paperAuthors.authorId, a.id),
						eq(papers.projectId, projectId)
					)
				)
				.groupBy(keywords.term)
				.orderBy(desc(sql`COUNT(*)`))
				.limit(5);

			return {
				...a,
				topKeywords: topKws.map((k) => k.term)
			};
		})
	);

	// Co-authorship pairs
	const coAuthorPairs: CoAuthorPair[] = [];
	// Simple approach: for papers with multiple authors, find pairs
	const projectPapers = await db
		.select({ id: papers.id })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)));

	const paperAuthorMap = new Map<string, string[]>();
	for (const p of projectPapers) {
		const authorList = await db
			.select({ name: authors.name })
			.from(paperAuthors)
			.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
			.where(eq(paperAuthors.paperId, p.id));
		paperAuthorMap.set(p.id, authorList.map((a) => a.name));
	}

	// Count co-occurrences
	const pairCounts = new Map<string, number>();
	for (const authorNames of paperAuthorMap.values()) {
		for (let i = 0; i < authorNames.length; i++) {
			for (let j = i + 1; j < authorNames.length; j++) {
				const key = [authorNames[i], authorNames[j]].sort().join('|||');
				pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
			}
		}
	}

	// Top co-author pairs
	for (const [key, count] of [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
		const [a1, a2] = key.split('|||');
		coAuthorPairs.push({ author1: a1, author2: a2, sharedPapers: count });
	}

	return { authors: authorStats, coAuthorPairs };
}

// ─── Trend Analysis ────────────────────────────────────────────────

export interface TrendData {
	keywordTrends: { keyword: string; years: { year: number; count: number }[] }[];
	yearlyPaperCounts: { year: number; count: number }[];
}

export async function analyzeTrends(projectId: string): Promise<TrendData> {
	const yearlyPaperCounts = await db
		.select({
			year: papers.publicationYear,
			count: sql<number>`COUNT(*)`
		})
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	// Top keywords over time
	const topKeywords = await db
		.select({
			term: keywords.term,
			count: sql<number>`COUNT(*)`
		})
		.from(paperKeywords)
		.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
		.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(keywords.term)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(10);

	const keywordTrends = await Promise.all(
		topKeywords.map(async (kw) => {
			const years = await db
				.select({
					year: papers.publicationYear,
					count: sql<number>`COUNT(*)`
				})
				.from(paperKeywords)
				.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
				.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
				.where(
					and(
						eq(papers.projectId, projectId),
						eq(keywords.term, kw.term),
						eq(papers.isRelevant, true)
					)
				)
				.groupBy(papers.publicationYear)
				.orderBy(papers.publicationYear);

			return {
				keyword: kw.term,
				years: years.map((y) => ({ year: y.year!, count: y.count }))
			};
		})
	);

	return {
		keywordTrends,
		yearlyPaperCounts: yearlyPaperCounts.map((y) => ({ year: y.year!, count: y.count }))
	};
}

// ─── Gap Analysis (LLM-powered) ───────────────────────────────────

export async function analyzeGaps(projectId: string): Promise<{
	gaps: string[];
	suggestions: string[];
}> {
	const ctx = await loadPromptContext(projectId);

	// Gather corpus summary
	const byRegion = await db
		.select({ region: papers.focusedRegion, count: sql<number>`COUNT(*)` })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(papers.focusedRegion)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(10);

	const byPlatform = await db
		.select({ platform: papers.platformDomain, count: sql<number>`COUNT(*)` })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(papers.platformDomain)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(10);

	const byYear = await db
		.select({ year: papers.publicationYear, count: sql<number>`COUNT(*)` })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	const topTags = await db
		.select({ dimension: analysisTags.dimension, value: analysisTags.value, count: sql<number>`COUNT(*)` })
		.from(analysisTags)
		.innerJoin(papers, eq(papers.id, analysisTags.paperId))
		.where(eq(papers.projectId, projectId))
		.groupBy(analysisTags.dimension, analysisTags.value)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(30);

	const corpusSummary = `
Research domain: ${ctx.projectName}
${ctx.projectDescription}

Coverage summary:
- Regions: ${byRegion.map((r) => `${r.region} (${r.count})`).join(', ') || 'None'}
- Platforms: ${byPlatform.map((p) => `${p.platform} (${p.count})`).join(', ') || 'None'}
- Years: ${byYear.map((y) => `${y.year}: ${y.count}`).join(', ') || 'None'}
- Top analysis tags: ${topTags.map((t) => `${t.dimension}=${t.value} (${t.count})`).join(', ') || 'None'}
`;

	try {
		const prompt = `You are a research methodology expert analyzing the coverage of a systematic literature review.

${corpusSummary}

Based on this corpus, identify:
1. "gaps": 3-5 under-researched areas, geographic blind spots, missing methodologies, or temporal gaps
2. "suggestions": 3-5 actionable suggestions for expanding the review (new search terms, venues, authors to investigate)

Respond ONLY with a valid JSON object with these two arrays of strings. No other text.`;

		const { text } = await generateText({
			model: getModel(),
			prompt
		});

		const cleaned = text.trim().replace(/^```json?\s*/, '').replace(/```\s*$/, '');
		const result = JSON.parse(cleaned);

		return {
			gaps: result.gaps || [],
			suggestions: result.suggestions || []
		};
	} catch (e) {
		console.error('Gap analysis failed:', e);
		return { gaps: [], suggestions: [] };
	}
}

// ─── Duplicate Detection ───────────────────────────────────────────

export interface DuplicatePair {
	paper1: { id: string; title: string };
	paper2: { id: string; title: string };
	similarity: number;
}

export async function findDuplicates(projectId: string): Promise<DuplicatePair[]> {
	const allPapers = await db
		.select({ id: papers.id, title: papers.title })
		.from(papers)
		.where(eq(papers.projectId, projectId));

	const duplicates: DuplicatePair[] = [];

	// Jaccard similarity on word sets
	function wordSet(title: string): Set<string> {
		return new Set(
			title
				.toLowerCase()
				.replace(/[^a-z0-9\s]/g, '')
				.split(/\s+/)
				.filter((w) => w.length > 2)
		);
	}

	function jaccard(a: Set<string>, b: Set<string>): number {
		const intersection = new Set([...a].filter((x) => b.has(x)));
		const union = new Set([...a, ...b]);
		return union.size === 0 ? 0 : intersection.size / union.size;
	}

	const wordSets = allPapers.map((p) => ({ ...p, words: wordSet(p.title) }));

	for (let i = 0; i < wordSets.length; i++) {
		for (let j = i + 1; j < wordSets.length; j++) {
			const sim = jaccard(wordSets[i].words, wordSets[j].words);
			if (sim >= 0.85) {
				duplicates.push({
					paper1: { id: wordSets[i].id, title: wordSets[i].title },
					paper2: { id: wordSets[j].id, title: wordSets[j].title },
					similarity: Math.round(sim * 100) / 100
				});
			}
		}
	}

	return duplicates.sort((a, b) => b.similarity - a.similarity);
}
