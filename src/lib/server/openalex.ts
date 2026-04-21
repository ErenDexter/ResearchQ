/**
 * OpenAlex API Service
 * Docs: https://docs.openalex.org
 *
 * Used to discover academic papers via multiple search strategies:
 * journal, author, topic, citation chains, and related works.
 */

import { env } from '$env/dynamic/private';

const BASE_URL = 'https://api.openalex.org';
const WORKS_SELECT =
	'id,title,doi,publication_year,abstract_inverted_index,authorships,primary_location,keywords,best_oa_location,primary_topic,open_access,cited_by_count,referenced_works,related_works';

function buildParams(extra: Record<string, string> = {}): URLSearchParams {
	const params = new URLSearchParams(extra);
	if (env.OPENALEX_API_KEY) params.set('api_key', env.OPENALEX_API_KEY);
	if (env.OPENALEX_EMAIL) params.set('mailto', env.OPENALEX_EMAIL);
	params.set('per_page', '200');
	return params;
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`OpenAlex ${res.status}: ${body}`);
	}
	return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface OpenAlexWork {
	id: string;
	title: string;
	doi: string | null;
	publication_year: number;
	abstract_inverted_index: Record<string, number[]> | null;
	authorships: {
		author: { id: string; display_name: string; orcid: string | null };
		institutions: { display_name: string }[];
		author_position: string;
	}[];
	primary_location: {
		source: {
			id: string;
			display_name: string;
			issn_l: string | null;
			type?: string;
			host_organization_name?: string | null;
		} | null;
	} | null;
	keywords: { id: string; display_name: string; score: number }[];
	best_oa_location: { pdf_url: string | null; landing_page_url: string | null } | null;
	primary_topic: { display_name: string } | null;
	open_access: { oa_url: string | null } | null;
	cited_by_count?: number;
	referenced_works?: string[];
	related_works?: string[];
}

interface OpenAlexResponse {
	meta: { count: number; per_page: number; page: number };
	results: OpenAlexWork[];
	next_cursor?: string;
}

export interface OpenAlexSource {
	id: string;
	display_name: string;
	issn_l: string | null;
	type?: string; // 'journal', 'conference', 'repository', etc.
	host_organization_name?: string | null; // publisher: 'ACM', 'IEEE', 'Elsevier', etc.
}

export interface OpenAlexAuthor {
	id: string;
	display_name: string;
	orcid: string | null;
	last_known_institutions: { display_name: string }[];
}

export interface OpenAlexPublisher {
	id: string;
	display_name: string;
	alternate_titles: string[];
	country_codes: string[];
	hierarchy_level: number;
	lineage: string[];
	works_count: number;
}

// ─── Reconstruct abstract from inverted index ──────────────────────

export function reconstructAbstract(
	invertedIndex: Record<string, number[]> | null
): string {
	if (!invertedIndex) return '';
	const words: [number, string][] = [];
	for (const [word, positions] of Object.entries(invertedIndex)) {
		for (const pos of positions) {
			words.push([pos, word]);
		}
	}
	words.sort((a, b) => a[0] - b[0]);
	return words.map((w) => w[1]).join(' ');
}

// ─── Resolve journal (source) by name ──────────────────────────────

export async function resolveSource(
	journalName: string
): Promise<OpenAlexSource | null> {
	const params = buildParams({ search: journalName });
	const url = `${BASE_URL}/sources?${params.toString()}`;
	const data = await fetchJson<{ results: OpenAlexSource[] }>(url);
	if (data.results.length === 0) return null;
	return data.results[0];
}

// ─── Resolve author by name ────────────────────────────────────────

export async function resolveAuthor(
	authorName: string
): Promise<OpenAlexAuthor | null> {
	const params = buildParams({ search: authorName });
	const url = `${BASE_URL}/authors?${params.toString()}`;
	const data = await fetchJson<{ results: OpenAlexAuthor[] }>(url);
	if (data.results.length === 0) return null;
	return data.results[0];
}

// ─── Resolve publisher by name ────────────────────────────────────

export async function resolvePublisher(
	publisherName: string
): Promise<OpenAlexPublisher | null> {
	const params = buildParams({ search: publisherName });
	const url = `${BASE_URL}/publishers?${params.toString()}`;
	const data = await fetchJson<{ results: OpenAlexPublisher[] }>(url);
	if (data.results.length === 0) return null;

	// Pick the publisher with the most works — the top-level parent org
	// aggregates all sub-orgs so it always has the highest works_count.
	// E.g. "IEEE" → "Institute of Electrical and Electronics Engineers"
	// (1.4M works) rather than "IEEE Computer Society" (82K works).
	return data.results.reduce((best, p) =>
		p.works_count > best.works_count ? p : best
	);
}

// ─── Batch keywords into small groups ───────────────────────────────

function batchKeywords(terms: string[], size: number = 4): string[] {
	return Array.from({ length: Math.ceil(terms.length / size) }, (_, i) =>
		terms.slice(i * size, i * size + size).join(' OR ')
	);
}

function appendDateFilter(filter: string, dateFrom?: string, dateTo?: string): string {
	if (dateFrom) filter += `,from_publication_date:${dateFrom}`;
	if (dateTo) filter += `,to_publication_date:${dateTo}`;
	return filter;
}

// ─── Paginated search helper ───────────────────────────────────────

async function paginatedSearch(
	filter: string,
	searchQuery: string | null,
	maxPages: number,
	seenIds: Set<string>,
	allWorks: OpenAlexWork[]
): Promise<void> {
	let cursor = '*';

	for (let page = 0; page < maxPages; page++) {
		const paramObj: Record<string, string> = {
			filter,
			cursor,
			select: WORKS_SELECT
		};
		if (searchQuery) paramObj.search = searchQuery;

		const params = buildParams(paramObj);
		const url = `${BASE_URL}/works?${params.toString()}`;
		const data = await fetchJson<OpenAlexResponse>(url);

		for (const work of data.results) {
			if (!seenIds.has(work.id)) {
				seenIds.add(work.id);
				allWorks.push(work);
			}
		}

		if (!data.next_cursor || data.results.length === 0) break;
		cursor = data.next_cursor;

		await sleep(150);
	}
}

// ─── Paginated search with cursor resumption + result cap ─────────

async function paginatedSearchWithCursor(
	filter: string,
	searchQuery: string | null,
	maxResults: number,
	seenIds: Set<string>,
	allWorks: OpenAlexWork[],
	startCursor: string = '*'
): Promise<string | null> {
	let cursor = startCursor;
	const perPage = 200;
	const maxPages = Math.ceil(maxResults / perPage);

	for (let page = 0; page < maxPages; page++) {
		const paramObj: Record<string, string> = {
			filter,
			cursor,
			select: WORKS_SELECT
		};
		if (searchQuery) paramObj.search = searchQuery;

		const params = buildParams(paramObj);
		const url = `${BASE_URL}/works?${params.toString()}`;

		console.log(`[openalex] cursor-page ${page + 1}/${maxPages}: ${url.slice(0, 200)}...`);

		const data = await fetchJson<OpenAlexResponse>(url);

		console.log(`[openalex] cursor-page ${page + 1}/${maxPages}: ${data.results.length} results, meta.count=${data.meta.count}`);

		for (const work of data.results) {
			if (!seenIds.has(work.id)) {
				seenIds.add(work.id);
				allWorks.push(work);
			}
			if (allWorks.length >= maxResults) break;
		}

		if (!data.next_cursor || data.results.length === 0) return null; // exhausted
		cursor = data.next_cursor;

		if (allWorks.length >= maxResults) return cursor; // cap reached, return resume point

		await sleep(150);
	}

	return cursor; // pages exhausted but more results available
}

// ─── Search papers by publisher/database ──────────────────────────
// Uses batched keywords (groups of 4) to avoid OpenAlex's search
// parameter choking on very long OR strings.
// Supports per-batch cursor resumption so repeated runs fetch NEW papers.

export interface DatabaseBatchCursor {
	searchQuery: string;
	nextCursor: string | null; // null = exhausted
}

export async function searchByDatabase(
	publisherId: string,
	keywordTerms: string[],
	maxResults: number = 200,
	batchCursors?: DatabaseBatchCursor[],
	dateFrom?: string,
	dateTo?: string
): Promise<{ works: OpenAlexWork[]; batchCursors: DatabaseBatchCursor[] }> {
	const batches = batchKeywords(keywordTerms); // groups of 4
	const seenIds = new Set<string>();
	const allWorks: OpenAlexWork[] = [];
	const filter = appendDateFilter(`primary_location.source.host_organization_lineage:${publisherId}`, dateFrom, dateTo);
	const maxPagesPerBatch = Math.max(2, Math.ceil(maxResults / (200 * batches.length)) + 1);

	// Build a lookup of saved cursors by search query
	const cursorMap = new Map<string, string | null>();
	if (batchCursors) {
		for (const bc of batchCursors) cursorMap.set(bc.searchQuery, bc.nextCursor);
	}

	const updatedCursors: DatabaseBatchCursor[] = [];

	for (let bi = 0; bi < batches.length; bi++) {
		const searchQuery = batches[bi];
		const savedCursor = cursorMap.get(searchQuery);

		// If this batch was previously exhausted, skip it
		if (savedCursor === null && cursorMap.has(searchQuery)) {
			console.log(`[openalex] batch ${bi + 1}/${batches.length}: skipped (cursor exhausted)`);
			updatedCursors.push({ searchQuery, nextCursor: null });
			continue;
		}

		const startCursor = savedCursor || '*';
		const batchWorks: OpenAlexWork[] = [];
		const batchSeen = new Set<string>();
		const batchMaxResults = Math.min(maxResults - allWorks.length, maxPagesPerBatch * 200);

		console.log(`[openalex] batch ${bi + 1}/${batches.length}: query="${searchQuery.slice(0, 80)}", filter="${filter.slice(0, 100)}", maxResults=${batchMaxResults}, cursor=${startCursor === '*' ? 'start' : 'resumed'}`);

		const nextCursor = await paginatedSearchWithCursor(
			filter,
			searchQuery,
			batchMaxResults,
			batchSeen,
			batchWorks,
			startCursor
		);

		console.log(`[openalex] batch ${bi + 1}/${batches.length}: got ${batchWorks.length} works, nextCursor=${nextCursor ? 'available' : 'exhausted'}`);

		// Merge into main results (dedup across batches)
		for (const work of batchWorks) {
			if (!seenIds.has(work.id)) {
				seenIds.add(work.id);
				allWorks.push(work);
			}
		}

		updatedCursors.push({ searchQuery, nextCursor });

		if (allWorks.length >= maxResults) break;
		await sleep(150);
	}

	// Trim to maxResults cap
	if (allWorks.length > maxResults) allWorks.length = maxResults;

	return { works: allWorks, batchCursors: updatedCursors };
}

// ─── Search papers by journal + keywords ───────────────────────────

export async function searchByJournal(
	journalName: string,
	keywordTerms: string[],
	maxPages: number = 3,
	dateFrom?: string,
	dateTo?: string
): Promise<{ source: OpenAlexSource | null; works: OpenAlexWork[] }> {
	const source = await resolveSource(journalName);
	if (!source) return { source: null, works: [] };

	const sourceId = source.id.replace('https://openalex.org/', '');
	const filter = appendDateFilter(`primary_location.source.id:${sourceId}`, dateFrom, dateTo);
	const batches = batchKeywords(keywordTerms);
	const seenIds = new Set<string>();
	const allWorks: OpenAlexWork[] = [];

	for (const searchQuery of batches) {
		await paginatedSearch(
			filter,
			searchQuery,
			maxPages,
			seenIds,
			allWorks
		);
		await sleep(150);
	}

	return { source, works: allWorks };
}

// ─── Search papers by author + keywords (legacy) ──────────────────

export async function searchByAuthor(
	authorName: string,
	keywordTerms: string[],
	maxPages: number = 3
): Promise<{ author: OpenAlexAuthor | null; works: OpenAlexWork[] }> {
	const author = await resolveAuthor(authorName);
	if (!author) return { author: null, works: [] };

	const authorId = author.id.replace('https://openalex.org/', '');
	const batches = batchKeywords(keywordTerms);
	const seenIds = new Set<string>();
	const allWorks: OpenAlexWork[] = [];

	for (const searchQuery of batches) {
		await paginatedSearch(
			`authorships.author.id:${authorId}`,
			searchQuery,
			maxPages,
			seenIds,
			allWorks
		);
		await sleep(150);
	}

	return { author, works: allWorks };
}

// ─── Smart author search (hybrid: keyword-filtered + capped unfiltered) ──
//
// Problem: keyword-filtered search can return 0 if the author uses different
// terminology. But fetching ALL papers for a prolific author (500+) wastes
// Gemini quota.
//
// Solution — two phases:
//   A) Keyword-filtered search (catches obvious matches)
//   B) Unfiltered search capped at ~200 papers, then a cheap LOCAL pre-filter
//      on title/abstract/topic to discard obviously irrelevant papers before
//      they ever reach Gemini.

export async function searchByAuthorOnly(
	authorName: string,
	keywordTerms?: string[],
	maxUnfilteredPages: number = 1
): Promise<{ author: OpenAlexAuthor | null; works: OpenAlexWork[] }> {
	const author = await resolveAuthor(authorName);
	if (!author) return { author: null, works: [] };

	const authorId = author.id.replace('https://openalex.org/', '');
	const seenIds = new Set<string>();
	const allWorks: OpenAlexWork[] = [];

	// Phase A: keyword-filtered search (if keywords provided)
	if (keywordTerms && keywordTerms.length > 0) {
		const batches = batchKeywords(keywordTerms);
		for (const searchQuery of batches) {
			await paginatedSearch(
				`authorships.author.id:${authorId}`,
				searchQuery,
				2, // fewer pages per batch since we also do Phase B
				seenIds,
				allWorks
			);
			await sleep(150);
		}
	}

	// Phase B: unfiltered search (capped) to catch papers with different terminology
	const unfilteredWorks: OpenAlexWork[] = [];
	const unfilteredSeen = new Set<string>(seenIds); // start from what we already have

	await paginatedSearch(
		`authorships.author.id:${authorId}`,
		null,
		maxUnfilteredPages, // 1 page = up to 200 papers
		unfilteredSeen,
		unfilteredWorks
	);

	// Local pre-filter: only keep unfiltered papers whose title, abstract, or
	// topic have at least a loose textual overlap with the project keywords.
	// This is a cheap string check — NOT an LLM call.
	if (keywordTerms && keywordTerms.length > 0 && unfilteredWorks.length > 0) {
		const lowerKeywords = keywordTerms.map((k) => k.toLowerCase());

		for (const work of unfilteredWorks) {
			if (seenIds.has(work.id)) continue; // already captured in Phase A

			const haystack = [
				work.title || '',
				reconstructAbstract(work.abstract_inverted_index),
				work.primary_topic?.display_name || '',
				...(work.keywords || []).map((kw) => kw.display_name || '')
			]
				.join(' ')
				.toLowerCase();

			// Keep the paper if ANY keyword fragment appears in the haystack.
			// We split multi-word keywords into individual words and require
			// at least one full keyword OR two individual keyword-words to match.
			const hasFullMatch = lowerKeywords.some((kw) => haystack.includes(kw));
			const wordHits = lowerKeywords
				.flatMap((kw) => kw.split(/\s+/))
				.filter((w) => w.length > 3 && haystack.includes(w));
			const hasWordMatch = wordHits.length >= 2;

			if (hasFullMatch || hasWordMatch) {
				seenIds.add(work.id);
				allWorks.push(work);
			}
		}
	} else {
		// No keywords to pre-filter against — just add them all (capped by maxUnfilteredPages)
		for (const work of unfilteredWorks) {
			if (!seenIds.has(work.id)) {
				seenIds.add(work.id);
				allWorks.push(work);
			}
		}
	}

	return { author, works: allWorks };
}

// ─── Search by topic/keywords only (no journal/author constraint) ──

export async function searchByTopic(
	keywordTerms: string[],
	maxPages: number = 3,
	dateFrom?: string,
	dateTo?: string
): Promise<OpenAlexWork[]> {
	const batches = batchKeywords(keywordTerms);
	const seenIds = new Set<string>();
	const allWorks: OpenAlexWork[] = [];
	const dateFilter = appendDateFilter('', dateFrom, dateTo).replace(/^,/, ''); // strip leading comma

	for (const searchQuery of batches) {
		let cursor = '*';

		for (let page = 0; page < maxPages; page++) {
			const paramObj: Record<string, string> = {
				search: searchQuery,
				cursor,
				select: WORKS_SELECT
			};
			if (dateFilter) paramObj.filter = dateFilter;

			const params = buildParams(paramObj);

			const url = `${BASE_URL}/works?${params.toString()}`;
			const data = await fetchJson<OpenAlexResponse>(url);

			for (const work of data.results) {
				if (!seenIds.has(work.id)) {
					seenIds.add(work.id);
					allWorks.push(work);
				}
			}

			if (!data.next_cursor || data.results.length === 0) break;
			cursor = data.next_cursor;

			await sleep(150);
		}

		await sleep(150);
	}

	return allWorks;
}

// ─── Search papers that cite a given paper (forward citations) ─────

export async function searchCitationsForward(
	openalexId: string,
	maxPages: number = 5
): Promise<OpenAlexWork[]> {
	const cleanId = openalexId.replace('https://openalex.org/', '');
	const seenIds = new Set<string>();
	const allWorks: OpenAlexWork[] = [];

	await paginatedSearch(
		`cites:${cleanId}`,
		null,
		maxPages,
		seenIds,
		allWorks
	);

	return allWorks;
}

// ─── Search papers cited by a given paper (backward citations) ─────

export async function searchCitationsBackward(
	openalexId: string
): Promise<OpenAlexWork[]> {
	const cleanId = openalexId.replace('https://openalex.org/', '');

	// First, fetch the paper itself to get its referenced_works
	const params = buildParams({ select: 'id,referenced_works' });
	const url = `${BASE_URL}/works/${cleanId}?${params.toString()}`;

	const work = await fetchJson<OpenAlexWork>(url);
	const refIds = work.referenced_works || [];

	if (refIds.length === 0) return [];

	// Fetch referenced works in batches of 50
	return getWorksByIds(refIds);
}

// ─── Search related works ──────────────────────────────────────────

export async function searchRelatedWorks(
	openalexId: string
): Promise<OpenAlexWork[]> {
	const cleanId = openalexId.replace('https://openalex.org/', '');

	const params = buildParams({ select: 'id,related_works' });
	const url = `${BASE_URL}/works/${cleanId}?${params.toString()}`;

	const work = await fetchJson<OpenAlexWork>(url);
	const relatedIds = work.related_works || [];

	if (relatedIds.length === 0) return [];

	return getWorksByIds(relatedIds.slice(0, 50)); // Limit to 50 related works
}

// ─── Batch fetch works by OpenAlex IDs ─────────────────────────────

export async function getWorksByIds(
	openalexIds: string[],
	batchSize: number = 50
): Promise<OpenAlexWork[]> {
	const allWorks: OpenAlexWork[] = [];

	for (let i = 0; i < openalexIds.length; i += batchSize) {
		const batch = openalexIds.slice(i, i + batchSize);
		const idFilter = batch
			.map((id) => id.replace('https://openalex.org/', ''))
			.join('|');

		const params = buildParams({
			filter: `openalex:${idFilter}`,
			select: WORKS_SELECT
		});

		const url = `${BASE_URL}/works?${params.toString()}`;
		const data = await fetchJson<OpenAlexResponse>(url);
		allWorks.push(...data.results);

		await sleep(150);
	}

	return allWorks;
}

// ─── Get paper URL ─────────────────────────────────────────────────

export function getPaperUrl(work: OpenAlexWork): string {
	if (work.open_access?.oa_url) return work.open_access.oa_url;
	if (work.best_oa_location?.pdf_url) return work.best_oa_location.pdf_url;
	if (work.best_oa_location?.landing_page_url) return work.best_oa_location.landing_page_url;
	if (work.doi) return work.doi.startsWith('http') ? work.doi : `https://doi.org/${work.doi}`;
	return '';
}

// ─── Utils ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
