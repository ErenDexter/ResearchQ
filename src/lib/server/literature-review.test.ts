import { beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { projectReviews, reviewMethodologies, reviewOutputs, searchJobs } from './db/schema';
import { generateOutput, OutputGenerationError, rowsByStudyIndex } from './literature-review';
import { generateStructured } from './llm';
import { createProject, createSchema, insertPaper } from '../../test/db';

vi.mock('./llm', async (importOriginal) => ({
	...(await importOriginal<typeof import('./llm')>()),
	generateStructured: vi.fn()
}));

let projectId: string;
let emptyProjectId: string;
let reviewId: string;
let emptyReviewId: string;

async function createReview(project: string): Promise<string> {
	const [method] = await db.select().from(reviewMethodologies).limit(1);
	const [review] = await db
		.insert(projectReviews)
		.values({ projectId: project, methodologyId: method.id })
		.returning();
	return review.id;
}

beforeAll(async () => {
	await createSchema();
	await db
		.insert(reviewMethodologies)
		.values({ name: 'PRISMA', description: 'd', type: 'systematic' });

	projectId = await createProject('Review project');
	emptyProjectId = await createProject('Empty project');
	reviewId = await createReview(projectId);
	emptyReviewId = await createReview(emptyProjectId);

	await db.insert(searchJobs).values([
		{ projectId, type: 'topic', query: 'a', totalFound: 10 },
		{ projectId, type: 'journal', query: 'b', totalFound: 5 }
	]);
	// cited_by_count decides which studies the LLM sees first
	await insertPaper(projectId, {
		title: 'Included by AI',
		isRelevant: true,
		relevanceSource: 'ai',
		citedByCount: 50
	});
	await insertPaper(projectId, {
		title: 'Kept by default',
		isRelevant: true,
		relevanceSource: 'ai_fallback',
		citedByCount: 10
	});
	await insertPaper(projectId, {
		title: 'Excluded by AI',
		isRelevant: false,
		relevanceSource: 'ai'
	});
	await insertPaper(projectId, { title: 'Not screened yet' });
});

describe('PRISMA flow', () => {
	it('does not count unscreened records as excluded', async () => {
		const output = await generateOutput(projectId, reviewId, 'prisma_flow_diagram');
		const data = JSON.parse(output.contentJson!);
		expect(data.identification.records_identified).toBe(15);
		expect(data.screening).toEqual({
			records_after_duplicates_removed: 4,
			records_screened: 3,
			records_excluded: 1,
			records_awaiting_screening: 1
		});
		expect(data.included.studies_included).toBe(2);
		expect(data.note).toContain('1 records have not been screened');
		expect(data.note).toContain('1 included records were kept by default');
	});

	it('replaces the previous version when regenerated', async () => {
		await generateOutput(projectId, reviewId, 'prisma_flow_diagram');
		const rows = await db
			.select()
			.from(reviewOutputs)
			.where(eq(reviewOutputs.projectReviewId, reviewId));
		expect(rows.filter((r) => r.outputType === 'prisma_flow_diagram')).toHaveLength(1);
	});
});

describe('study selection table', () => {
	it('labels decisions and who made them', async () => {
		const output = await generateOutput(projectId, reviewId, 'inclusion_exclusion_table');
		const { rows } = JSON.parse(output.contentJson!);
		const byTitle = Object.fromEntries(rows.map((r: Record<string, unknown>) => [r.title, r]));
		expect(byTitle['Not screened yet'].decision).toBe('Not screened');
		expect(byTitle['Excluded by AI'].decision).toBe('Excluded');
		expect(byTitle['Kept by default'].reason).toMatch(/verify manually/);
	});
});

describe('generateOutput guards', () => {
	it('refuses LLM syntheses when no studies are included', async () => {
		await expect(
			generateOutput(emptyProjectId, emptyReviewId, 'narrative_summary')
		).rejects.toMatchObject({
			status: 400
		});
	});

	it('rejects a review from another project', async () => {
		const err = await generateOutput(emptyProjectId, reviewId, 'prisma_flow_diagram').catch(
			(e) => e
		);
		expect(err).toBeInstanceOf(OutputGenerationError);
		expect(err.status).toBe(404);
	});
});

describe('quality appraisal', () => {
	it('attaches scores to the study the model named, even if it reorders or skips studies', async () => {
		// Studies are sent most-cited first: [1] "Included by AI", [2] "Kept by default".
		vi.mocked(generateStructured).mockResolvedValueOnce({
			assessments: [
				{
					index: 2,
					objectives: 0,
					methodology: 0,
					sample: 1,
					analysis: 0,
					reporting: 0,
					quality: 'low'
				}
			]
		});
		const output = await generateOutput(projectId, reviewId, 'quality_appraisal_table');
		const data = JSON.parse(output.contentJson!);
		const byTitle = Object.fromEntries(data.rows.map((r: Record<string, unknown>) => [r.title, r]));

		expect(byTitle['Kept by default']).toMatchObject({
			objectives: 0,
			sample: 1,
			totalScore: 1,
			quality: 'low'
		});
		expect(byTitle['Included by AI'].quality).toBe('Not assessed');
		expect(data.columns.map((c: { key: string }) => c.key)).toContain('totalScore');
		expect(data.note).toBe('Generated from all 2 included studies.');
	});
});

describe('rowsByStudyIndex', () => {
	it('ignores out-of-range and duplicate indices', () => {
		const rows = rowsByStudyIndex(
			[{ title: 'one' }, { title: 'two' }],
			[
				{ index: 2, v: 'b' },
				{ index: 2, v: 'dup' },
				{ index: 9, v: 'x' },
				{ index: 0, v: 'y' }
			],
			(a) => ({ v: a.v }),
			{ v: 'missing' }
		);
		expect(rows).toEqual([
			{ title: 'one', v: 'missing' },
			{ title: 'two', v: 'b' }
		]);
	});
});
