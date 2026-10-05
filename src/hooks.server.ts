import type { Handle, ServerInit } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { ensureMethodologiesSeeded } from '$lib/server/db/seed-methodologies';
import { recoverInterruptedJobs } from '$lib/server/job-queue';

export const init: ServerInit = async () => {
	// Best-effort: on a fresh install the tables may not exist until `pnpm db:push`
	// has run. Seeding is retried lazily by the root layout in that case.
	try {
		await ensureMethodologiesSeeded();
	} catch (err) {
		console.error(
			'[startup] Could not seed methodologies (has `pnpm db:push` been run?):',
			err instanceof Error ? err.message : err
		);
	}
	try {
		await recoverInterruptedJobs();
	} catch (err) {
		console.error(
			'[startup] Could not recover interrupted jobs:',
			err instanceof Error ? err.message : err
		);
	}
};

function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

function isAuthorized(header: string | null, username: string, password: string): boolean {
	const [scheme, encoded] = (header ?? '').split(' ');
	if (scheme?.toLowerCase() !== 'basic' || !encoded) return false;
	const decoded = Buffer.from(encoded, 'base64').toString('utf8');
	const sep = decoded.indexOf(':');
	if (sep < 0) return false;
	// Compare both parts unconditionally so timing doesn't reveal which one was wrong.
	const userOk = safeEqual(decoded.slice(0, sep), username);
	const passOk = safeEqual(decoded.slice(sep + 1), password);
	return userOk && passOk;
}

/**
 * Optional HTTP Basic auth for deployments reachable from the internet.
 * Enabled only when both AUTH_USERNAME and AUTH_PASSWORD are set.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const username = env.AUTH_USERNAME;
	const password = env.AUTH_PASSWORD;

	if (
		username &&
		password &&
		!isAuthorized(event.request.headers.get('authorization'), username, password)
	) {
		return new Response('Authentication required', {
			status: 401,
			headers: { 'WWW-Authenticate': 'Basic realm="ResearchQ", charset="UTF-8"' }
		});
	}

	return resolve(event);
};
