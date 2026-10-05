import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { analysisTags, papers, searchJobs } from './db/schema';
import { parseTopicTerms, pipelineDelays, runSearchJob } from './jobs';
import { INTERRUPTED_JOB_MESSAGE, jobQueue, recoverInterruptedJobs } from './job-queue';
import { searchByTopic, type OpenAlexWork } from './openalex';
import {
	classifyAnalysisFramework,
	evaluateKeywordRelevance,
	extractMetadata,
	filterRelevance
} from './gemini';
import { createProject, createSchema } from '../../test/db';

vi.mock('./openalex', async (importOriginal) => ({
	...(await importOriginal<typeof import('./openalex')>()),
	searchByTopic: vi.fn()
}));

vi.mock('./gemini', () => ({
	filterRelevance: vi.fn(),
	extractMetadata: vi.fn(),
	classifyAnalysisFramework: vi.fn(),
	evaluateKeywordRelevance: vi.fn()
}));

function work(n: number): OpenAlexWork {
	return {
		id: `https://openalex.org/W${n}`,
		title: `Paper ${n}`,
		doi: `https://doi.org/10.1000/${n}`,
		publication_year: 2020 + n,
		abstract_inverted_index: { Algorithmic: [0], audits: [1] },
		authorships: [
			{
				author: { id: `https://openalex.org/A${n}`, display_name: `Author ${n}`, orcid: null },
				institutions: [],
				author_position: 'first'
			}
		],
		primary_location: {
			source: {
				id: 'https://openalex.org/S1',
				display_name: 'Journal One',
				issn_l: null,
				type: 'journal',
				host_organization_name: 'Pub'
			}
		},
		keywords: [{ id: 'k1', display_name: 'Fairness', score: 0.9 }],
		best_oa_location: null,
		primary_topic: null,
		open_access: null,
		cited_by_count: n
	};
}

const metadata = {
	summary: 'A summary',
	methodologySummary: 'Interviews',
	targetPopulation: 'Workers',
	focusedRegion: 'Europe',
	platformDomain: 'Hiring',
	extractedKeywords: ['audit']
};

async function createJob(projectId: string, values: Partial<typeof searchJobs.$inferInsert> = {}) {
	const [job] = await db
		.insert(searchJobs)
		.values({ projectId, type: 'topic', query: '', ...values })
		.returning();
	return job.id;
}

async function getJob(id: string) {
	const [job] = await db.select().from(searchJobs).where(eq(searchJobs.id, id));
	return job;
}

beforeAll(async () => {
	await createSchema();
	pipelineDelays.betweenFilterBatchesMs = 0;
	pipelineDelays.betweenExtractionsMs = 0;
});

beforeEach(() => {
	vi.mocked(searchByTopic)
		.mockReset()
		.mockResolvedValue([work(1), work(2)]);
	vi.mocked(filterRelevance)
		.mockReset()
		.mockImplementation(async (batch) =>
			batch.map((p) => ({ id: p.id, isRelevant: true, confidence: 0.9, source: 'ai' as const }))
		);
	vi.mocked(extractMetadata).mockReset().mockResolvedValue(metadata);
	vi.mocked(classifyAnalysisFramework).mockReset().mockResolvedValue({ method: 'Qualitative' });
	vi.mocked(evaluateKeywordRelevance).mockReset().mockResolvedValue([]);
});

describe('runSearchJob', () => {
	it('stores the same work in every project that finds it', async () => {
		const projectA = await createProject('A', ['audit a']);
		const projectB = await createProject('B', ['audit b']);

		const jobA = await createJob(projectA);
		const jobB = await createJob(projectB);
		await runSearchJob(jobA);
		await runSearchJob(jobB);

		const inA = await db.select().from(papers).where(eq(papers.projectId, projectA));
		const inB = await db.select().from(papers).where(eq(papers.projectId, projectB));
		expect(inA.map((p) => p.openalexId).sort()).toEqual([
			'https://openalex.org/W1',
			'https://openalex.org/W2'
		]);
		expect(inB.map((p) => p.openalexId).sort()).toEqual([
			'https://openalex.org/W1',
			'https://openalex.org/W2'
		]);

		// A second search in the same project does not duplicate papers
		await runSearchJob(await createJob(projectA));
		expect(await db.select().from(papers).where(eq(papers.projectId, projectA))).toHaveLength(2);

		const job = await getJob(jobB);
		expect(job.status).toBe('completed');
		expect(job.relevantCount).toBe(2);
		expect(typeof job.relevantCount).toBe('number');
	});

	it('searches the typed topic terms, or the project keywords when the query is empty', async () => {
		const projectId = await createProject('Topic', ['kw one', 'kw two']);

		await runSearchJob(await createJob(projectId, { query: 'fairness, hiring bias' }));
		expect(vi.mocked(searchByTopic).mock.calls[0][0]).toEqual(['fairness', 'hiring bias']);

		await runSearchJob(await createJob(projectId, { query: '' }));
		expect(vi.mocked(searchByTopic).mock.calls[1][0].sort()).toEqual(['kw one', 'kw two']);
	});

	it('records who made each screening decision', async () => {
		const projectId = await createProject('Provenance');
		vi.mocked(filterRelevance).mockImplementation(async (batch) => [
			{ id: batch[0].id, isRelevant: false, confidence: 0.8, source: 'ai' },
			{ id: batch[1].id, isRelevant: true, confidence: 0, source: 'ai_fallback' }
		]);
		await runSearchJob(await createJob(projectId));

		const rows = await db.select().from(papers).where(eq(papers.projectId, projectId));
		const bySource = Object.fromEntries(rows.map((p) => [p.relevanceSource, p.isRelevant]));
		expect(bySource).toEqual({ ai: false, ai_fallback: true });

		const skipped = await createProject('Skip');
		await runSearchJob(await createJob(skipped, { skipRelevanceFilter: true }));
		const kept = await db.select().from(papers).where(eq(papers.projectId, skipped));
		expect(kept.every((p) => p.isRelevant === true && p.relevanceSource === 'auto_include')).toBe(
			true
		);
	});

	it('fails on an API error during screening and resumes on retry', async () => {
		const projectId = await createProject('Retry screening');
		vi.mocked(filterRelevance).mockRejectedValueOnce(new Error('rate limited'));

		const jobId = await createJob(projectId);
		await runSearchJob(jobId);
		let job = await getJob(jobId);
		expect(job.status).toBe('failed');
		expect(job.error).toContain('rate limited');
		expect(JSON.parse(job.completedPhases!)).toEqual(['search', 'store']);
		// Nothing was auto-included because of the outage
		const unscreened = await db
			.select()
			.from(papers)
			.where(and(eq(papers.projectId, projectId)));
		expect(unscreened.every((p) => p.isRelevant === null)).toBe(true);

		await runSearchJob(jobId);
		job = await getJob(jobId);
		expect(job.status).toBe('completed');
		expect(vi.mocked(searchByTopic)).toHaveBeenCalledTimes(1); // search phase not repeated
	});

	it('keeps the extraction phase open when papers fail, and retries only those', async () => {
		const projectId = await createProject('Retry extraction');
		vi.mocked(extractMetadata)
			.mockResolvedValueOnce(metadata)
			.mockRejectedValueOnce(new Error('timeout'));

		const jobId = await createJob(projectId);
		await runSearchJob(jobId);
		let job = await getJob(jobId);
		expect(job.status).toBe('failed');
		expect(job.error).toContain('1 of 2 papers');
		expect(JSON.parse(job.completedPhases!)).not.toContain('extract');

		await runSearchJob(jobId);
		job = await getJob(jobId);
		expect(job.status).toBe('completed');
		expect(vi.mocked(extractMetadata)).toHaveBeenCalledTimes(3);

		const rows = await db.select().from(papers).where(eq(papers.projectId, projectId));
		expect(rows.every((p) => p.summary === 'A summary')).toBe(true);
		// One tag per paper — retries never duplicate tags
		for (const p of rows) {
			expect(
				await db.select().from(analysisTags).where(eq(analysisTags.paperId, p.id))
			).toHaveLength(1);
		}
	});
});

describe('recoverInterruptedJobs', () => {
	it('fails jobs that were mid-run and re-queues jobs that never started', async () => {
		const projectId = await createProject('Recovery');
		const running = await createJob(projectId, { status: 'extracting' });
		const waiting = await createJob(projectId, { status: 'pending' });

		await recoverInterruptedJobs();

		const failed = await getJob(running);
		expect(failed.status).toBe('failed');
		expect(failed.error).toBe(INTERRUPTED_JOB_MESSAGE);
		expect(jobQueue.has(waiting)).toBe(true);

		// Let the re-queued job finish before the test ends
		await vi.waitFor(async () => expect((await getJob(waiting)).status).toBe('completed'), {
			timeout: 5000
		});
	});
});

describe('parseTopicTerms', () => {
	it('splits on commas, semicolons and new lines', () => {
		expect(parseTopicTerms(' a , b;c\n d ')).toEqual(['a', 'b', 'c', 'd']);
		expect(parseTopicTerms('algorithmic fairness in hiring')).toEqual([
			'algorithmic fairness in hiring'
		]);
		expect(parseTopicTerms('  ')).toEqual([]);
	});
});
