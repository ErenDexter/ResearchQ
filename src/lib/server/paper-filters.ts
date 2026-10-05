/**
 * Shared paper filtering for the cross-reference matrix and exports, so an
 * export always contains exactly what the matrix shows for the same filters.
 */

import { and, eq, gte, inArray, lte, type SQL } from 'drizzle-orm';
import { db } from './db';
import { papers, paperJournals, journals, paperKeywords, keywords } from './db/schema';
import { containsInsensitive } from './db/helpers';

export interface PaperFilters {
	projectId: string;
	relevantOnly?: boolean;
	search?: string;
	yearMin?: number;
	yearMax?: number;
	region?: string;
	platform?: string;
	/** Publisher / database name (matched against the paper's venue publisher). */
	database?: string;
	keyword?: string;
	/** Only papers first found by this search job. */
	jobId?: string;
}

function optionalInt(value: string | null): number | undefined {
	if (!value) return undefined;
	const n = parseInt(value, 10);
	return Number.isFinite(n) ? n : undefined;
}

export function parsePaperFilters(projectId: string, params: URLSearchParams): PaperFilters {
	return {
		projectId,
		relevantOnly: params.get('relevant') === 'true',
		search: params.get('search')?.trim() || undefined,
		yearMin: optionalInt(params.get('yearMin')),
		yearMax: optionalInt(params.get('yearMax')),
		region: params.get('region')?.trim() || undefined,
		platform: params.get('platform')?.trim() || undefined,
		database: params.get('database')?.trim() || undefined,
		keyword: params.get('keyword')?.trim() || undefined,
		jobId: params.get('jobId')?.trim() || undefined
	};
}

export function buildPaperWhere(filters: PaperFilters): SQL | undefined {
	const conditions: SQL[] = [eq(papers.projectId, filters.projectId)];

	if (filters.relevantOnly) conditions.push(eq(papers.isRelevant, true));
	if (filters.search) conditions.push(containsInsensitive(papers.title, filters.search));
	if (filters.yearMin !== undefined) conditions.push(gte(papers.publicationYear, filters.yearMin));
	if (filters.yearMax !== undefined) conditions.push(lte(papers.publicationYear, filters.yearMax));
	if (filters.region) conditions.push(containsInsensitive(papers.focusedRegion, filters.region));
	if (filters.platform)
		conditions.push(containsInsensitive(papers.platformDomain, filters.platform));
	if (filters.jobId) conditions.push(eq(papers.searchJobId, filters.jobId));

	if (filters.database) {
		conditions.push(
			inArray(
				papers.id,
				db
					.select({ id: paperJournals.paperId })
					.from(paperJournals)
					.innerJoin(journals, eq(journals.id, paperJournals.journalId))
					.where(containsInsensitive(journals.publisher, filters.database))
			)
		);
	}

	if (filters.keyword) {
		conditions.push(
			inArray(
				papers.id,
				db
					.select({ id: paperKeywords.paperId })
					.from(paperKeywords)
					.innerJoin(keywords, eq(keywords.id, paperKeywords.keywordId))
					.where(containsInsensitive(keywords.term, filters.keyword))
			)
		);
	}

	return and(...conditions);
}

/** Reads `page`/`limit` query params, clamped to sane bounds. */
export function parsePagination(
	params: URLSearchParams,
	{ defaultLimit = 50, maxLimit = 200 } = {}
): { page: number; limit: number; offset: number } {
	const page = Math.max(1, optionalInt(params.get('page')) ?? 1);
	const limit = Math.min(maxLimit, Math.max(1, optionalInt(params.get('limit')) ?? defaultLimit));
	return { page, limit, offset: (page - 1) * limit };
}
