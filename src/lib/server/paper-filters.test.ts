import { beforeAll, describe, expect, it } from 'vitest';
import { asc } from 'drizzle-orm';
import { db } from './db';
import { journals, keywords, paperJournals, paperKeywords, papers } from './db/schema';
import { buildPaperWhere, parsePagination, parsePaperFilters } from './paper-filters';
import { createProject, createSchema, insertPaper } from '../../test/db';

let projectId: string;
let otherProjectId: string;

async function titles(params: Record<string, string>): Promise<string[]> {
	const where = buildPaperWhere(parsePaperFilters(projectId, new URLSearchParams(params)));
	const rows = await db
		.select({ title: papers.title })
		.from(papers)
		.where(where)
		.orderBy(asc(papers.title));
	return rows.map((r) => r.title);
}

beforeAll(async () => {
	await createSchema();
	projectId = await createProject('Main');
	otherProjectId = await createProject('Other');

	const ieee = (
		await db.insert(journals).values({ name: 'IEEE Access', publisher: 'IEEE' }).returning()
	)[0];
	const acm = (await db.insert(journals).values({ name: 'CSCW', publisher: 'ACM' }).returning())[0];
	const [fairness] = await db.insert(keywords).values({ term: 'algorithmic fairness' }).returning();

	const a = await insertPaper(projectId, {
		title: 'Auditing Hiring Algorithms',
		publicationYear: 2020,
		isRelevant: true,
		focusedRegion: 'United States'
	});
	const b = await insertPaper(projectId, {
		title: 'Credit scoring audits',
		publicationYear: 2023,
		isRelevant: false
	});
	await insertPaper(projectId, { title: '100% coverage of audits', publicationYear: 2021 });
	await insertPaper(otherProjectId, { title: 'Auditing in another project' });

	await db.insert(paperJournals).values([
		{ paperId: a, journalId: ieee.id },
		{ paperId: b, journalId: acm.id }
	]);
	await db.insert(paperKeywords).values({ paperId: a, keywordId: fairness.id });
});

describe('buildPaperWhere', () => {
	it('scopes to the project', async () => {
		expect(await titles({})).toEqual([
			'100% coverage of audits',
			'Auditing Hiring Algorithms',
			'Credit scoring audits'
		]);
	});

	it('filters by publisher on SQLite (regression: raw ILIKE is a syntax error there)', async () => {
		expect(await titles({ database: 'ieee' })).toEqual(['Auditing Hiring Algorithms']);
	});

	it('filters by keyword, case-insensitively', async () => {
		expect(await titles({ keyword: 'FAIRNESS' })).toEqual(['Auditing Hiring Algorithms']);
	});

	it('matches title search case-insensitively and treats LIKE wildcards literally', async () => {
		expect(await titles({ search: 'AUDIT' })).toHaveLength(3);
		expect(await titles({ search: '100%' })).toEqual(['100% coverage of audits']);
		expect(await titles({ search: '%' })).toEqual(['100% coverage of audits']);
	});

	it('applies year range, region and relevance filters', async () => {
		expect(await titles({ yearMin: '2021', yearMax: '2022' })).toEqual(['100% coverage of audits']);
		expect(await titles({ region: 'united' })).toEqual(['Auditing Hiring Algorithms']);
		expect(await titles({ relevant: 'true' })).toEqual(['Auditing Hiring Algorithms']);
	});

	it('ignores malformed numbers', async () => {
		expect(await titles({ yearMin: 'abc' })).toHaveLength(3);
	});
});

describe('parsePagination', () => {
	it('clamps page and limit', () => {
		expect(parsePagination(new URLSearchParams('page=0&limit=100000'))).toEqual({
			page: 1,
			limit: 200,
			offset: 0
		});
		expect(parsePagination(new URLSearchParams('page=3&limit=abc'))).toEqual({
			page: 3,
			limit: 50,
			offset: 100
		});
	});
});
