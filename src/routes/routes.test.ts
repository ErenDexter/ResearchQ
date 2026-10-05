/**
 * Route-level tests: call the real handlers against a throwaway SQLite DB.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { methodologyPhases, reviewMethodologies } from '$lib/server/db/schema';
import { createProject, createSchema, insertPaper } from '../test/db';
import { GET as listProjects } from './api/projects/+server';
import { GET as listMethods } from './api/literature-review/methods/+server';
import { POST as createJob } from './api/jobs/+server';
import { load as layoutLoad } from './+layout.server';

vi.mock('$lib/server/job-queue', () => ({ jobQueue: { enqueue: vi.fn(), has: () => false } }));

function cookies(values: Record<string, string> = {}): Cookies {
	return { get: (name: string) => values[name] } as unknown as Cookies;
}

// The handlers only read the fields they need; cast the minimal event.
const event = (e: Record<string, unknown>) => e as any;

let older: string;
let newer: string;

beforeAll(async () => {
	await createSchema();
	older = await createProject('Older', ['k1', 'k2']);
	newer = await createProject('Newer', ['k1']);
	await insertPaper(older, { title: 'one', openalexId: 'W1' });
	await insertPaper(older, { title: 'two', openalexId: 'W2' });
	await insertPaper(newer, { title: 'one', openalexId: 'W1' });
});

describe('GET /api/projects', () => {
	it('returns real per-project counts (regression: correlated subquery bound to the wrong id)', async () => {
		const res = await listProjects(event({}));
		const { projects } = await res.json();
		const byName = Object.fromEntries(projects.map((p: { name: string }) => [p.name, p]));
		expect(byName.Older).toMatchObject({ paperCount: 2, keywordCount: 2 });
		expect(byName.Newer).toMatchObject({ paperCount: 1, keywordCount: 1 });
	});
});

describe('GET /api/literature-review/methods', () => {
	it('counts phases per methodology', async () => {
		const [method] = await db
			.insert(reviewMethodologies)
			.values({ name: 'M', description: 'd', type: 't' })
			.returning();
		await db.insert(methodologyPhases).values([
			{ methodologyId: method.id, name: 'p1' },
			{ methodologyId: method.id, name: 'p2' }
		]);
		const { methods } = await (await listMethods(event({ url: new URL('http://x/') }))).json();
		expect(methods.find((m: { id: string }) => m.id === method.id).phaseCount).toBe(2);
	});
});

describe('root layout load', () => {
	it('uses the project cookie, falling back to the newest project', async () => {
		const run = (c: Record<string, string>) =>
			layoutLoad(event({ url: new URL('http://x/'), cookies: cookies(c) })) as Promise<{
				currentProjectId: string;
			}>;
		// createdAt has one-second resolution, so both projects may share a timestamp;
		// the fallback must still be one of them and the cookie must win.
		expect([older, newer]).toContain((await run({})).currentProjectId);
		expect((await run({ currentProjectId: older })).currentProjectId).toBe(older);
		expect((await run({ currentProjectId: 'deleted-project' })).currentProjectId).not.toBe(
			'deleted-project'
		);
	});
});

describe('POST /api/jobs', () => {
	const post = (body: unknown) =>
		createJob(
			event({
				request: new Request('http://x/', { method: 'POST', body: JSON.stringify(body) }),
				cookies: cookies()
			})
		);

	it('rejects unsupported types and missing queries', async () => {
		expect((await post({ type: 'snowball', query: 'x', projectId: older })).status).toBe(400);
		expect((await post({ type: 'journal', query: ' ', projectId: older })).status).toBe(400);
	});

	it('accepts a topic search without a query (uses project keywords)', async () => {
		const res = await post({ type: 'topic', projectId: older });
		expect(res.status).toBe(201);
		expect((await res.json()).query).toBe('');
	});
});
