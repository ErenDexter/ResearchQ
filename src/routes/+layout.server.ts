import { redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { seedMethodologies } from '$lib/server/db/seed-methodologies';
import type { LayoutServerLoad } from './$types';

let initialized = false;

export const load: LayoutServerLoad = async ({ url }) => {
	// One-time library data seeding (methodologies only — user-owned
	// seed data was removed so every install starts empty).
	if (!initialized) {
		await seedMethodologies();
		initialized = true;
	}

	// If there are zero projects and the user isn't already on the
	// creation page, redirect them there. This is the self-hosted
	// onboarding entry point.
	const [{ c }] = (await db
		.select({ c: sql<number>`COUNT(*)` })
		.from(projects)) as { c: number }[];
	const projectCount = Number(c ?? 0);

	if (projectCount === 0 && url.pathname !== '/projects/new') {
		throw redirect(307, '/projects/new');
	}

	return { projectCount };
};
