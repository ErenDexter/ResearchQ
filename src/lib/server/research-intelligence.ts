/**
 * Research Intelligence — gap analysis, trends, author networks, duplicates.
 */

import { z } from 'zod';
import { generateStructured } from './llm';
import { db } from './db';
import {
	papers,
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	analysisTags
} from './db/schema';
import { eq, and, desc, count, countDistinct, inArray } from 'drizzle-orm';
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
	const included = and(eq(papers.projectId, projectId), eq(papers.isRelevant, true));

	// Prolific authors
	const prolificAuthors = await db
		.select({
			id: authors.id,
			name: authors.name,
			affiliation: authors.affiliation,
			paperCount: countDistinct(papers.id)
		})
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
		.where(included)
		.groupBy(authors.id)
		.orderBy(desc(countDistinct(papers.id)), authors.name)
		.limit(20);

	// Top keywords for the prolific authors, in one query
	const keywordRows =
		prolificAuthors.length === 0
			? []
			: await db
					.select({ authorId: paperAuthors.authorId, term: keywords.term, n: count() })
					.from(paperKeywords)
					.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
					.innerJoin(paperAuthors, eq(paperAuthors.paperId, paperKeywords.paperId))
					.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
					.where(
						and(
							eq(papers.projectId, projectId),
							inArray(paperAuthors.authorId, prolificAuthors.map((a) => a.id))
						)
					)
					.groupBy(paperAuthors.authorId, keywords.term)
					.orderBy(desc(count()), keywords.term);

	const topKeywordsByAuthor = new Map<string, string[]>();
	for (const row of keywordRows) {
		const list = topKeywordsByAuthor.get(row.authorId) ?? [];
		if (list.length < 5) list.push(row.term);
		topKeywordsByAuthor.set(row.authorId, list);
	}

	const authorStats: AuthorStats[] = prolificAuthors.map((a) => ({
		...a,
		topKeywords: topKeywordsByAuthor.get(a.id) ?? []
	}));

	// Co-authorship pairs from one query of (paper, author) rows
	const authorshipRows = await db
		.select({ paperId: paperAuthors.paperId, name: authors.name })
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
		.where(included);

	const paperAuthorMap = new Map<string, string[]>();
	for (const row of authorshipRows) {
		const list = paperAuthorMap.get(row.paperId) ?? [];
		list.push(row.name);
		paperAuthorMap.set(row.paperId, list);
	}

	return { authors: authorStats, coAuthorPairs: topCoAuthorPairs(paperAuthorMap.values(), 20) };
}

export function topCoAuthorPairs(authorLists: Iterable<string[]>, limit: number): CoAuthorPair[] {
	const pairCounts = new Map<string, number>();
	for (const names of authorLists) {
		const unique = [...new Set(names)];
		for (let i = 0; i < unique.length; i++) {
			for (let j = i + 1; j < unique.length; j++) {
				const key = [unique[i], unique[j]].sort().join('|||');
				pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
			}
		}
	}

	return [...pairCounts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, limit)
		.map(([key, sharedPapers]) => {
			const [author1, author2] = key.split('|||');
			return { author1, author2, sharedPapers };
		});
}

// ─── Trend Analysis ────────────────────────────────────────────────

export interface TrendData {
	keywordTrends: { keyword: string; years: { year: number; count: number }[] }[];
	yearlyPaperCounts: { year: number; count: number }[];
}

export async function analyzeTrends(projectId: string): Promise<TrendData> {
	const included = and(eq(papers.projectId, projectId), eq(papers.isRelevant, true));

	const yearlyPaperCounts = await db
		.select({
			year: papers.publicationYear,
			count: count()
		})
		.from(papers)
		.where(included)
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	// Top keywords over time
	const topKeywords = await db
		.select({
			term: keywords.term,
			count: count()
		})
		.from(paperKeywords)
		.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
		.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
		.where(included)
		.groupBy(keywords.term)
		.orderBy(desc(count()), keywords.term)
		.limit(10);

	const yearRows =
		topKeywords.length === 0
			? []
			: await db
					.select({
						term: keywords.term,
						year: papers.publicationYear,
						count: count()
					})
					.from(paperKeywords)
					.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
					.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
					.where(and(included, inArray(keywords.term, topKeywords.map((k) => k.term))))
					.groupBy(keywords.term, papers.publicationYear)
					.orderBy(papers.publicationYear);

	const keywordTrends = topKeywords.map((kw) => ({
		keyword: kw.term,
		years: yearRows
			.filter((r) => r.term === kw.term && r.year !== null)
			.map((r) => ({ year: r.year!, count: r.count }))
	}));

	return {
		keywordTrends,
		yearlyPaperCounts: yearlyPaperCounts
			.filter((y) => y.year !== null)
			.map((y) => ({ year: y.year!, count: y.count }))
	};
}

// ─── Gap Analysis (LLM-powered) ───────────────────────────────────

const gapSchema = z.object({
	gaps: z.array(z.string()),
	suggestions: z.array(z.string())
});

export async function analyzeGaps(projectId: string): Promise<{
	gaps: string[];
	suggestions: string[];
}> {
	const ctx = await loadPromptContext(projectId);
	const included = and(eq(papers.projectId, projectId), eq(papers.isRelevant, true));

	// Gather corpus summary
	const byRegion = await db
		.select({ region: papers.focusedRegion, count: count() })
		.from(papers)
		.where(included)
		.groupBy(papers.focusedRegion)
		.orderBy(desc(count()))
		.limit(10);

	if (byRegion.length === 0) return { gaps: [], suggestions: [] };

	const byPlatform = await db
		.select({ platform: papers.platformDomain, count: count() })
		.from(papers)
		.where(included)
		.groupBy(papers.platformDomain)
		.orderBy(desc(count()))
		.limit(10);

	const byYear = await db
		.select({ year: papers.publicationYear, count: count() })
		.from(papers)
		.where(included)
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	const topTags = await db
		.select({ dimension: analysisTags.dimension, value: analysisTags.value, count: count() })
		.from(analysisTags)
		.innerJoin(papers, eq(papers.id, analysisTags.paperId))
		.where(included)
		.groupBy(analysisTags.dimension, analysisTags.value)
		.orderBy(desc(count()))
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
		return await generateStructured(
			gapSchema,
			`You are a research methodology expert analyzing the coverage of a systematic literature review.

${corpusSummary}

Based on this corpus, identify:
1. "gaps": 3-5 under-researched areas, geographic blind spots, missing methodologies, or temporal gaps
2. "suggestions": 3-5 actionable suggestions for expanding the review (new search terms, venues, authors to investigate)

Respond ONLY with a JSON object with these two arrays of strings. No other text.`
		);
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

/** Normalized title tokens: letters/digits in any script, words longer than 2 characters. */
export function titleTokens(title: string): string[] {
	return [
		...new Set(
			title
				.normalize('NFKC')
				.toLowerCase()
				.replace(/[^\p{L}\p{N}\s]/gu, ' ')
				.split(/\s+/)
				.filter((w) => w.length > 2)
		)
	];
}

/**
 * Finds pairs of titles with Jaccard similarity ≥ threshold.
 *
 * Uses prefix filtering (as in the AllPairs algorithm): with tokens ordered
 * rarest-first, two sets can only reach the threshold if they share a token
 * within their first |set| − ⌈threshold·|set|⌉ + 1 tokens. Only those
 * candidate pairs are compared, instead of every pair.
 */
export function findSimilarTitles<T extends { id: string; title: string }>(
	items: T[],
	threshold = 0.85
): DuplicatePair[] {
	const tokenSets = items.map((p) => titleTokens(p.title));

	const frequency = new Map<string, number>();
	for (const tokens of tokenSets) for (const t of tokens) frequency.set(t, (frequency.get(t) ?? 0) + 1);
	const order = (a: string, b: string) => (frequency.get(a)! - frequency.get(b)!) || (a < b ? -1 : a > b ? 1 : 0);
	for (const tokens of tokenSets) tokens.sort(order);

	const sets = tokenSets.map((tokens) => new Set(tokens));
	const index = new Map<string, number[]>();
	const duplicates: DuplicatePair[] = [];

	for (let i = 0; i < items.length; i++) {
		const tokens = tokenSets[i];
		if (tokens.length === 0) continue;
		// (epsilon guards against float error, e.g. 0.85 * 100 = 85.00000000000001)
		const prefixLength = tokens.length - Math.ceil(threshold * tokens.length - 1e-9) + 1;
		const candidates = new Set<number>();

		for (const token of tokens.slice(0, prefixLength)) {
			for (const j of index.get(token) ?? []) candidates.add(j);
		}

		for (const j of candidates) {
			const a = sets[i];
			const b = sets[j];
			// Size filter: Jaccard can't reach the threshold if sizes differ too much.
			if (Math.min(a.size, b.size) < threshold * Math.max(a.size, b.size) - 1e-9) continue;
			let intersection = 0;
			for (const t of a) if (b.has(t)) intersection++;
			const similarity = intersection / (a.size + b.size - intersection);
			if (similarity >= threshold - 1e-9) {
				duplicates.push({
					paper1: { id: items[j].id, title: items[j].title },
					paper2: { id: items[i].id, title: items[i].title },
					similarity: Math.round(similarity * 100) / 100
				});
			}
		}

		for (const token of tokens.slice(0, prefixLength)) {
			const list = index.get(token) ?? [];
			list.push(i);
			index.set(token, list);
		}
	}

	return duplicates.sort((a, b) => b.similarity - a.similarity);
}

export async function findDuplicates(projectId: string): Promise<DuplicatePair[]> {
	const allPapers = await db
		.select({ id: papers.id, title: papers.title })
		.from(papers)
		.where(eq(papers.projectId, projectId));

	return findSimilarTitles(allPapers);
}
