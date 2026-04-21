/**
 * Background Job Runner — Resilient Step-wise Pipeline
 *
 * Each phase is independently resumable:
 * 1. Search OpenAlex → cache results in jobWorksCache
 * 2. Store papers → reads from cache, marks each as stored
 * 3. Filter relevance → processes papers where isRelevant IS NULL
 * 4. Extract metadata → processes papers where summary IS NULL
 * 5. Smart keyword filtering → idempotent (upsert)
 *
 * On failure, completedPhases tracks which phases finished.
 * On retry, completed phases are skipped entirely.
 */

import { db } from './db';
import {
	searchJobs,
	papers,
	authors,
	paperAuthors,
	keywords,
	paperKeywords,
	projectKeywords,
	journals,
	paperJournals,
	analysisTags,
	searchCursors,
	jobWorksCache
} from './db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import {
	searchByJournal,
	searchByAuthor,
	searchByAuthorOnly,
	searchByTopic,
	searchCitationsForward,
	searchCitationsBackward,
	searchRelatedWorks,
	searchByDatabase,
	resolvePublisher,
	reconstructAbstract,
	getPaperUrl,
	type OpenAlexWork
} from './openalex';
import {
	filterRelevance,
	extractMetadata,
	classifyAnalysisFramework,
	evaluateKeywordRelevance,
	type PaperInput
} from './gemini';
import { loadPromptContext } from './project-context';
import type { PromptContext } from './prompts';

// ─── Prefixed logger ──────────────────────────────────────────────

function log(jobId: string, ...args: unknown[]) {
	console.log(`[job:${jobId.slice(0, 8)}]`, ...args);
}

function logWarn(jobId: string, ...args: unknown[]) {
	console.warn(`[job:${jobId.slice(0, 8)}]`, ...args);
}

function logError(jobId: string, ...args: unknown[]) {
	console.error(`[job:${jobId.slice(0, 8)}]`, ...args);
}

// ─── Checkpoint helpers ───────────────────────────────────────────

function getCompletedPhases(raw: string | null): Set<string> {
	if (!raw) return new Set();
	try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
}

async function markPhaseComplete(jobId: string, phase: string, current: Set<string>) {
	current.add(phase);
	await db.update(searchJobs).set({
		completedPhases: JSON.stringify([...current])
	}).where(eq(searchJobs.id, jobId));
}

// ─── Load project keywords from DB ───────────────────────────────

async function getProjectKeywords(projectId: string): Promise<string[]> {
	const rows = await db
		.select({ term: keywords.term })
		.from(projectKeywords)
		.innerJoin(keywords, eq(projectKeywords.keywordId, keywords.id))
		.where(eq(projectKeywords.projectId, projectId));
	return rows.map((r) => r.term);
}

// ─── Update job status ─────────────────────────────────────────────

async function updateJob(
	jobId: string,
	updates: Partial<{
		status: string;
		totalFound: number;
		relevantCount: number;
		progressPct: number;
		error: string;
		completedAt: string;
		lastPhase: string;
		statusMessage: string;
	}>
) {
	await db.update(searchJobs).set(updates).where(eq(searchJobs.id, jobId));
}

// ─── Upsert an author ──────────────────────────────────────────────

async function upsertAuthor(
	name: string,
	openalexId: string,
	orcid: string | null,
	affiliation: string | null
): Promise<string> {
	const existing = await db
		.select({ id: authors.id })
		.from(authors)
		.where(eq(authors.openalexId, openalexId))
		.limit(1);

	if (existing.length > 0) return existing[0].id;

	const id = crypto.randomUUID();
	await db.insert(authors).values({ id, name, openalexId, orcid, affiliation });
	return id;
}

// ─── Upsert a keyword ──────────────────────────────────────────────

async function upsertKeyword(term: string, isBase: boolean = false): Promise<string> {
	const normalized = term.toLowerCase().trim();
	const existing = await db
		.select({ id: keywords.id })
		.from(keywords)
		.where(eq(keywords.term, normalized))
		.limit(1);

	if (existing.length > 0) return existing[0].id;

	const id = crypto.randomUUID();
	await db.insert(keywords).values({ id, term: normalized, isBaseKeyword: isBase });
	return id;
}

// ─── Store a paper and its relations ────────────────────────────────

async function storePaper(
	work: OpenAlexWork,
	jobId: string,
	projectId: string,
	sourceType: string,
	journalId: string | null
) {
	const openalexId = work.id;

	// Skip papers with no title
	if (!work.title || work.title.trim() === '') {
		log(jobId, `  skip: no title (${openalexId})`);
		return null;
	}

	// Check for duplicate
	const existing = await db
		.select({ id: papers.id })
		.from(papers)
		.where(eq(papers.openalexId, openalexId))
		.limit(1);

	if (existing.length > 0) {
		return existing[0].id;
	}

	const paperId = crypto.randomUUID();
	const abstract = reconstructAbstract(work.abstract_inverted_index);
	const doi = work.doi?.replace('https://doi.org/', '') || null;
	const source = work.primary_location?.source;
	const journalName = source?.display_name || null;

	await db.insert(papers).values({
		id: paperId,
		projectId,
		title: work.title,
		doi,
		openalexId,
		abstract,
		publicationYear: work.publication_year,
		paperUrl: getPaperUrl(work),
		sourceType,
		searchJobId: jobId,
		journalName,
		citedByCount: work.cited_by_count || 0
	});

	// Auto-create journal record from source if not already provided
	if (!journalId && source?.id && source?.display_name) {
		const existingJ = await db
			.select({ id: journals.id })
			.from(journals)
			.where(eq(journals.openalexId, source.id))
			.limit(1);

		if (existingJ.length > 0) {
			journalId = existingJ[0].id;
		} else {
			journalId = crypto.randomUUID();
			await db.insert(journals).values({
				id: journalId,
				name: source.display_name,
				issn: source.issn_l || null,
				openalexId: source.id,
				type: source.type || 'journal',
				publisher: source.host_organization_name || null
			});
		}
	}

	// Store author relationships
	for (const authorship of work.authorships) {
		const authorId = await upsertAuthor(
			authorship.author.display_name,
			authorship.author.id,
			authorship.author.orcid,
			authorship.institutions?.[0]?.display_name || null
		);
		try {
			await db.insert(paperAuthors).values({
				paperId,
				authorId,
				position:
					authorship.author_position === 'first'
						? 0
						: authorship.author_position === 'last'
							? 999
							: 1
			});
		} catch {
			// unique constraint
		}
	}

	// Store paper-keyword relationships from OpenAlex keywords
	for (const kw of work.keywords || []) {
		if (!kw.display_name) continue;
		const keywordId = await upsertKeyword(kw.display_name);
		try {
			await db.insert(paperKeywords).values({ paperId, keywordId });
		} catch {
			// unique constraint
		}
	}

	// Store journal relationship
	if (journalId) {
		try {
			await db.insert(paperJournals).values({ paperId, journalId });
		} catch {
			// unique constraint
		}
	}

	return paperId;
}

// ─── Main job pipeline (resilient, step-wise) ─────────────────────

export async function runSearchJob(jobId: string) {
	const startTime = Date.now();

	try {
		const job = await db
			.select()
			.from(searchJobs)
			.where(eq(searchJobs.id, jobId))
			.limit(1);
		if (!job.length) throw new Error(`Job ${jobId} not found`);

		const { type, query, projectId, dateFrom, dateTo, skipRelevanceFilter } = job[0];
		if (!projectId) throw new Error('Job has no project associated');

		const completed = getCompletedPhases(job[0].completedPhases);
		const isResume = completed.size > 0;

		log(jobId, `▶ ${isResume ? 'Resuming' : 'Starting'} job: type=${type}, query="${query}"${isResume ? ` (completed: ${[...completed].join(', ')})` : ''}`);

		// Load project context
		const promptCtx = await loadPromptContext(projectId);
		const keywordTerms = await getProjectKeywords(projectId);
		log(jobId, `  project="${promptCtx.projectName}", ${keywordTerms.length} keywords, ${promptCtx.dimensions.length} dimensions`);

		if (keywordTerms.length === 0) {
			throw new Error('No keywords found for this project. Add keywords first.');
		}

		const dateRangeLabel = dateFrom || dateTo ? ` [${dateFrom || '...'} → ${dateTo || '...'}]` : '';
		let journalId: string | null = null;

		// ════════════════════════════════════════════════════════════
		// PHASE 1: Search OpenAlex → cache in jobWorksCache
		// ════════════════════════════════════════════════════════════
		if (!completed.has('search')) {
			log(jobId, `── Phase 1: Searching OpenAlex (strategy: ${type}) ──`);
			await updateJob(jobId, { status: 'searching', progressPct: 5, lastPhase: 'searching', statusMessage: `Searching OpenAlex (${type}: "${query}")${dateRangeLabel}...` });

			let works: OpenAlexWork[] = [];

			if (type === 'journal') {
				log(jobId, `  resolving journal: "${query}"`);
				const result = await searchByJournal(query, keywordTerms, 3, dateFrom || undefined, dateTo || undefined);
				works = result.works;
				if (result.source) {
					log(jobId, `  resolved to: "${result.source.display_name}" (${result.source.id})`);
					const existingJournal = await db.select({ id: journals.id }).from(journals).where(eq(journals.openalexId, result.source.id)).limit(1);
					if (existingJournal.length > 0) {
						journalId = existingJournal[0].id;
					} else {
						journalId = crypto.randomUUID();
						await db.insert(journals).values({
							id: journalId, name: result.source.display_name, issn: result.source.issn_l,
							openalexId: result.source.id, type: result.source.type || 'journal',
							publisher: result.source.host_organization_name || null
						});
					}
				} else {
					logWarn(jobId, `  journal not found: "${query}"`);
				}
			} else if (type === 'author') {
				log(jobId, `  resolving author: "${query}"`);
				const result = await searchByAuthorOnly(query, keywordTerms);
				works = result.works;
				if (result.author) {
					log(jobId, `  resolved to: "${result.author.display_name}", ${works.length} candidates`);
					await upsertAuthor(result.author.display_name, result.author.id, result.author.orcid, result.author.last_known_institutions?.[0]?.display_name || null);
				} else {
					logWarn(jobId, `  author not found: "${query}"`);
				}
			} else if (type === 'topic') {
				log(jobId, `  topic search with ${keywordTerms.length} keywords`);
				works = await searchByTopic(keywordTerms, 3, dateFrom || undefined, dateTo || undefined);
			} else if (type === 'citation_forward') {
				works = await searchCitationsForward(query);
			} else if (type === 'citation_backward') {
				works = await searchCitationsBackward(query);
			} else if (type === 'related') {
				works = await searchRelatedWorks(query);
			} else if (type === 'database') {
				const maxResults = job[0].maxResults || 200;
				log(jobId, `  resolving publisher: "${query}" (max ${maxResults})`);
				const publisher = await resolvePublisher(query);
				if (publisher) {
					const publisherId = publisher.id.replace('https://openalex.org/', '');
					log(jobId, `  resolved to: "${publisher.display_name}" (${publisherId})`);
					// Load saved cursors — only use them if at least one batch has more results.
					// If ALL are exhausted, clear them and start fresh (keywords may have changed).
					let savedCursorRows = await db.select().from(searchCursors).where(and(eq(searchCursors.projectId, projectId), eq(searchCursors.publisherId, publisherId)));

					let batchCursors: { searchQuery: string; nextCursor: string | null }[] | undefined;

					if (savedCursorRows.length > 0) {
						const hasResumable = savedCursorRows.some((r) => r.nextCursor !== null);
						if (hasResumable) {
							batchCursors = savedCursorRows.map((r) => ({ searchQuery: r.searchQuery, nextCursor: r.nextCursor }));
							const resumable = savedCursorRows.filter((r) => r.nextCursor !== null).length;
							const prevTotal = savedCursorRows.reduce((sum, r) => sum + (r.totalFetched || 0), 0);
							log(jobId, `  resuming: ${resumable}/${savedCursorRows.length} batches have more results (${prevTotal} previously fetched)`);
						} else {
							log(jobId, `  all ${savedCursorRows.length} previous cursors exhausted — clearing stale cursors, starting fresh`);
							await db.delete(searchCursors).where(and(eq(searchCursors.projectId, projectId), eq(searchCursors.publisherId, publisherId)));
							savedCursorRows = [];
						}
					}
					const result = await searchByDatabase(publisherId, keywordTerms, maxResults, batchCursors, dateFrom || undefined, dateTo || undefined);
					works = result.works;
					for (const bc of result.batchCursors) {
						const existing = savedCursorRows.find((r) => r.searchQuery === bc.searchQuery);
						if (existing) {
							await db.update(searchCursors).set({ nextCursor: bc.nextCursor, totalFetched: (existing.totalFetched || 0) + works.length, lastJobId: jobId, updatedAt: new Date().toISOString() }).where(eq(searchCursors.id, existing.id));
						} else {
							await db.insert(searchCursors).values({ projectId, publisherId, publisherName: publisher.display_name, searchQuery: bc.searchQuery, nextCursor: bc.nextCursor, totalFetched: works.length, lastJobId: jobId });
						}
					}
				} else {
					logWarn(jobId, `  publisher not found: "${query}"`);
				}
			}

			log(jobId, `  OpenAlex returned ${works.length} works`);
			await updateJob(jobId, { totalFound: works.length, progressPct: 15 });

			if (works.length === 0) {
				await updateJob(jobId, { status: 'completed', progressPct: 100, relevantCount: 0, completedAt: new Date().toISOString(), statusMessage: 'No papers found.' });
				return;
			}

			// Cache works in DB so they survive crashes
			log(jobId, `  caching ${works.length} works in DB...`);
			for (const work of works) {
				try {
					await db.insert(jobWorksCache).values({
						jobId,
						openalexId: work.id,
						workData: JSON.stringify(work)
					});
				} catch {
					// duplicate — already cached from a partial previous run
				}
			}

			await markPhaseComplete(jobId, 'search', completed);
			log(jobId, `  ✓ Phase 1 complete: ${works.length} works cached`);
		} else {
			log(jobId, `  ⏭ Phase 1 (Search): already completed, skipping`);
		}

		// ════════════════════════════════════════════════════════════
		// PHASE 2: Store papers from cache → papers table
		// ════════════════════════════════════════════════════════════
		if (!completed.has('store')) {
			await updateJob(jobId, { status: 'searching', progressPct: 20, lastPhase: 'storing', statusMessage: 'Storing papers from cache...' });

			// Get unstored works from cache
			const unstoredWorks = await db
				.select({ id: jobWorksCache.id, openalexId: jobWorksCache.openalexId, workData: jobWorksCache.workData })
				.from(jobWorksCache)
				.where(and(eq(jobWorksCache.jobId, jobId), eq(jobWorksCache.stored, false)));

			const totalCached = (await db.select({ count: sql<number>`count(*)` }).from(jobWorksCache).where(eq(jobWorksCache.jobId, jobId)))[0]?.count || 0;
			const alreadyStored = totalCached - unstoredWorks.length;

			log(jobId, `── Phase 2: Storing papers (${unstoredWorks.length} remaining, ${alreadyStored} already stored) ──`);

			let newCount = 0;
			let dupCount = 0;

			for (let wi = 0; wi < unstoredWorks.length; wi++) {
				const cached = unstoredWorks[wi];
				const work: OpenAlexWork = JSON.parse(cached.workData);

				const existingCheck = await db.select({ id: papers.id }).from(papers).where(eq(papers.openalexId, work.id)).limit(1);

				if (existingCheck.length > 0) {
					dupCount++;
				} else {
					const paperId = await storePaper(work, jobId, projectId, `${type}_search`, journalId);
					if (paperId) newCount++;
				}

				// Mark as stored in cache (survives crash)
				await db.update(jobWorksCache).set({ stored: true }).where(eq(jobWorksCache.id, cached.id));

				if (wi % 5 === 0 || wi === unstoredWorks.length - 1) {
					const storeProgress = 20 + ((alreadyStored + wi + 1) / totalCached) * 20;
					await updateJob(jobId, {
						progressPct: Math.min(storeProgress, 40),
						statusMessage: `Storing: "${work.title?.slice(0, 60) || '(untitled)'}..." (${alreadyStored + wi + 1}/${totalCached}) — ${newCount} new, ${dupCount} skipped`
					});
				}
			}

			log(jobId, `  ✓ Phase 2 complete: ${newCount} new, ${dupCount} duplicates`);
			await markPhaseComplete(jobId, 'store', completed);
		} else {
			log(jobId, `  ⏭ Phase 2 (Store): already completed, skipping`);
		}

		await updateJob(jobId, { status: 'filtering', progressPct: 40, lastPhase: 'filtering', statusMessage: 'Starting relevance filtering...' });

		// ════════════════════════════════════════════════════════════
		// PHASE 3: Filter relevance (only unfiltered papers)
		// ════════════════════════════════════════════════════════════
		if (completed.has('filter')) {
			log(jobId, `  ⏭ Phase 3 (Filter): already completed, skipping`);
		} else if (skipRelevanceFilter) {
			// User opted out of LLM relevance filtering — mark all as relevant and skip
			log(jobId, `── Phase 3: SKIPPED (user opted out of LLM filtering) — marking all as relevant ──`);
			await db
				.update(papers)
				.set({ isRelevant: true })
				.where(and(eq(papers.searchJobId, jobId), isNull(papers.isRelevant)));
			const total = (await db.select({ count: sql<number>`count(*)` }).from(papers).where(eq(papers.searchJobId, jobId)))[0]?.count || 0;
			await updateJob(jobId, { progressPct: 60, relevantCount: total, statusMessage: `Phase 3 skipped — ${total} papers marked relevant without LLM filtering` });
			await markPhaseComplete(jobId, 'filter', completed);
		} else {
			const unfilteredPapers = await db
				.select({ id: papers.id, title: papers.title, abstract: papers.abstract, publicationYear: papers.publicationYear })
				.from(papers)
				.where(and(eq(papers.searchJobId, jobId), isNull(papers.isRelevant)));

			const alreadyFiltered = (await db.select({ count: sql<number>`count(*)` }).from(papers).where(and(eq(papers.searchJobId, jobId), sql`${papers.isRelevant} IS NOT NULL`)))[0]?.count || 0;

			log(jobId, `── Phase 3: Filtering relevance (${unfilteredPapers.length} remaining, ${alreadyFiltered} already filtered) ──`);

			const paperInputs: PaperInput[] = unfilteredPapers.map((p) => ({
				id: p.id, title: p.title, abstract: p.abstract || '', keywords: [], publicationYear: p.publicationYear ?? undefined
			}));

			const BATCH_SIZE = 15;
			let relevantCount = (await db.select({ count: sql<number>`count(*)` }).from(papers).where(and(eq(papers.searchJobId, jobId), eq(papers.isRelevant, true))))[0]?.count || 0;
			const totalBatches = Math.ceil(paperInputs.length / BATCH_SIZE);

			for (let i = 0; i < paperInputs.length; i += BATCH_SIZE) {
				const batchNum = Math.floor(i / BATCH_SIZE) + 1;
				const batch = paperInputs.slice(i, i + BATCH_SIZE);

				log(jobId, `  filtering batch ${batchNum}/${totalBatches} (${batch.length} papers)`);

				try {
					const results = await filterRelevance(batch, promptCtx);
					const batchRelevant = results.filter((r) => r.isRelevant).length;

					for (const result of results) {
						await db.update(papers).set({ isRelevant: result.isRelevant }).where(eq(papers.id, result.id));
						if (result.isRelevant) relevantCount++;
					}

					log(jobId, `    → ${batchRelevant}/${batch.length} relevant (total: ${relevantCount})`);
				} catch (err) {
					logError(jobId, `  batch ${batchNum} failed, marking as relevant:`, err instanceof Error ? err.message : err);
					for (const p of batch) {
						await db.update(papers).set({ isRelevant: true }).where(eq(papers.id, p.id));
						relevantCount++;
					}
				}

				const progress = 40 + ((i + BATCH_SIZE) / paperInputs.length) * 20;
				await updateJob(jobId, { progressPct: Math.min(progress, 60), relevantCount, statusMessage: `Filtering: batch ${batchNum}/${totalBatches} — ${relevantCount} relevant` });

				await new Promise((r) => setTimeout(r, 1000));
			}

			log(jobId, `  ✓ Phase 3 complete: ${relevantCount} relevant`);
			await updateJob(jobId, { relevantCount });
			await markPhaseComplete(jobId, 'filter', completed);
		}

		await updateJob(jobId, { status: 'extracting', progressPct: 60, lastPhase: 'extracting', statusMessage: 'Extracting metadata...' });

		// ════════════════════════════════════════════════════════════
		// PHASE 4: Extract metadata (only unextracted relevant papers)
		// ════════════════════════════════════════════════════════════
		if (!completed.has('extract')) {
			const unextracted = await db
				.select({ id: papers.id, title: papers.title, abstract: papers.abstract, publicationYear: papers.publicationYear })
				.from(papers)
				.where(and(eq(papers.searchJobId, jobId), eq(papers.isRelevant, true), isNull(papers.summary)));

			const alreadyExtracted = (await db.select({ count: sql<number>`count(*)` }).from(papers).where(and(eq(papers.searchJobId, jobId), eq(papers.isRelevant, true), sql`${papers.summary} IS NOT NULL`)))[0]?.count || 0;

			log(jobId, `── Phase 4: Extracting metadata (${unextracted.length} remaining, ${alreadyExtracted} already done) ──`);

			const allExtractedKeywords: string[] = [];
			let extractedOk = alreadyExtracted;
			let extractedFail = 0;

			for (let i = 0; i < unextracted.length; i++) {
				const p = unextracted[i];
				const paperInput: PaperInput = { id: p.id, title: p.title, abstract: p.abstract || '', keywords: [], publicationYear: p.publicationYear ?? undefined };

				log(jobId, `  [${alreadyExtracted + i + 1}] extracting: "${p.title.slice(0, 50)}..."`);

				try {
					const metadata = await extractMetadata(paperInput, promptCtx);

					log(jobId, `    → region="${metadata.focusedRegion}", platform="${metadata.platformDomain}"`);

					await db.update(papers).set({
						summary: metadata.summary, methodologySummary: metadata.methodologySummary,
						targetPopulation: metadata.targetPopulation, focusedRegion: metadata.focusedRegion,
						platformDomain: metadata.platformDomain
					}).where(eq(papers.id, p.id));

					allExtractedKeywords.push(...metadata.extractedKeywords);

					for (const kw of metadata.extractedKeywords) {
						const kwId = await upsertKeyword(kw, false);
						try { await db.insert(paperKeywords).values({ paperId: p.id, keywordId: kwId }); } catch { /* unique */ }
					}

					const tags = await classifyAnalysisFramework({ ...paperInput, summary: metadata.summary, methodologySummary: metadata.methodologySummary }, promptCtx);

					for (const [dimension, value] of Object.entries(tags)) {
						if (value) {
							await db.insert(analysisTags).values({ paperId: p.id, dimension, value });
						}
					}

					extractedOk++;
				} catch (err) {
					extractedFail++;
					logError(jobId, `    ✗ failed: ${err instanceof Error ? err.message : err}`);
				}

				const progress = 60 + ((alreadyExtracted + i + 1) / (unextracted.length + alreadyExtracted)) * 33;
				await updateJob(jobId, { progressPct: Math.min(progress, 93), statusMessage: `Extracting [${alreadyExtracted + i + 1}/${unextracted.length + alreadyExtracted}]: "${p.title.slice(0, 50)}..."` });

				await new Promise((r) => setTimeout(r, 500));
			}

			log(jobId, `  ✓ Phase 4 complete: ${extractedOk} ok, ${extractedFail} failed`);

			// Phase 4.5: keyword evaluation (inline, part of extract phase)
			if (allExtractedKeywords.length > 0) {
				const uniqueKw = [...new Set(allExtractedKeywords.map((k) => k.toLowerCase().trim()))];
				log(jobId, `  evaluating ${uniqueKw.length} extracted keywords...`);
				await updateJob(jobId, { progressPct: 95, statusMessage: `Evaluating ${uniqueKw.length} keywords...` });

				try {
					const kwResults = await evaluateKeywordRelevance(uniqueKw, promptCtx);
					const accepted = kwResults.filter((r) => r.isRelevant && r.score >= 0.6);
					log(jobId, `  keywords: ${accepted.length} accepted, ${kwResults.length - accepted.length} rejected`);

					for (const result of accepted) {
						const kwId = await upsertKeyword(result.keyword, false);
						try {
							await db.insert(projectKeywords).values({ projectId, keywordId: kwId, isBaseKeyword: false, relevanceScore: result.score });
						} catch {
							await db.update(projectKeywords).set({ relevanceScore: result.score }).where(and(eq(projectKeywords.projectId, projectId), eq(projectKeywords.keywordId, kwId)));
						}
					}
				} catch (err) {
					logError(jobId, '  keyword evaluation failed:', err instanceof Error ? err.message : err);
				}
			}

			await markPhaseComplete(jobId, 'extract', completed);
		} else {
			log(jobId, `  ⏭ Phase 4 (Extract): already completed, skipping`);
		}

		// ════════════════════════════════════════════════════════════
		// PHASE 5: Complete — clean up cache
		// ════════════════════════════════════════════════════════════
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		const totalPapers = (await db.select({ count: sql<number>`count(*)` }).from(papers).where(eq(papers.searchJobId, jobId)))[0]?.count || 0;
		const relevantCount = (await db.select({ count: sql<number>`count(*)` }).from(papers).where(and(eq(papers.searchJobId, jobId), eq(papers.isRelevant, true))))[0]?.count || 0;

		// Clean up the works cache
		await db.delete(jobWorksCache).where(eq(jobWorksCache.jobId, jobId));

		await updateJob(jobId, {
			status: 'completed', progressPct: 100, relevantCount,
			completedAt: new Date().toISOString(), lastPhase: 'completed',
			statusMessage: `Done in ${elapsed}s — ${totalPapers} papers, ${relevantCount} relevant`
		});

		log(jobId, `✓ Job complete in ${elapsed}s — ${totalPapers} papers, ${relevantCount} relevant`);
	} catch (err) {
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		logError(jobId, `✗ Job failed after ${elapsed}s:`, err instanceof Error ? err.message : err);
		if (err instanceof Error && err.stack) logError(jobId, err.stack);
		await updateJob(jobId, {
			status: 'failed',
			error: err instanceof Error ? err.message : String(err),
			completedAt: new Date().toISOString()
		});
	}
}
