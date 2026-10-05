import { redirect } from '@sveltejs/kit';
import { desc, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { numeric } from '$lib/server/db/helpers';
import { ensureMethodologiesSeeded } from '$lib/server/db/seed-methodologies';
import { PROJECT_COOKIE } from '$lib/project-cookie';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	// One-time library data seeding (methodologies only — user-owned
	// seed data was removed so every install starts empty).
	await ensureMethodologiesSeeded();

	const projectList = await db
		.select({
			id: projects.id,
			name: projects.name,
			status: projects.status,
			// Correlated subquery: reference the outer table by its literal name — drizzle renders
			// ${projects.id} unqualified here, which would bind to papers.id instead.
			paperCount: numeric(sql`(SELECT COUNT(*) FROM papers WHERE papers.project_id = projects.id)`)
		})
		.from(projects)
		.orderBy(desc(projects.createdAt));

	// If there are zero projects and the user isn't already on the
	// creation page, redirect them there. This is the self-hosted
	// onboarding entry point.
	if (projectList.length === 0 && url.pathname !== '/projects/new') {
		throw redirect(307, '/projects/new');
	}

	// The sidebar's selection lives in a cookie so server loads and API routes
	// see the same project as the UI. Fall back to the newest active project.
	const saved = cookies.get(PROJECT_COOKIE);
	const current =
		projectList.find((p) => p.id === saved) ??
		projectList.find((p) => p.status === 'active') ??
		projectList[0] ??
		null;

	return {
		projectCount: projectList.length,
		projects: projectList,
		currentProjectId: current?.id ?? null
	};
};
