import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { handle } from './hooks.server';

vi.mock('$lib/server/job-queue', () => ({ recoverInterruptedJobs: vi.fn() }));
vi.mock('$lib/server/db/seed-methodologies', () => ({ ensureMethodologiesSeeded: vi.fn() }));

const ok = new Response('ok');
const resolve = vi.fn(async () => ok);

function call(authorization?: string) {
	const headers = new Headers(authorization ? { authorization } : {});
	const event = { request: new Request('http://localhost/', { headers }) } as RequestEvent;
	return handle({ event, resolve });
}

const basic = (user: string, pass: string) =>
	`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

afterEach(() => {
	delete process.env.AUTH_USERNAME;
	delete process.env.AUTH_PASSWORD;
});

describe('basic auth hook', () => {
	it('is open when no credentials are configured', async () => {
		expect(await call()).toBe(ok);
	});

	it('requires matching credentials when configured', async () => {
		process.env.AUTH_USERNAME = 'alice';
		process.env.AUTH_PASSWORD = 's3cret:with:colons';

		const denied = await call();
		expect(denied.status).toBe(401);
		expect(denied.headers.get('www-authenticate')).toContain('Basic');

		expect((await call(basic('alice', 'wrong'))).status).toBe(401);
		expect((await call(basic('bob', 's3cret:with:colons'))).status).toBe(401);
		expect(await call(basic('alice', 's3cret:with:colons'))).toBe(ok);
	});
});
