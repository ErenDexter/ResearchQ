import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { sql, desc } from 'drizzle-orm';
import { numeric } from '$lib/server/db/helpers';

export const GET: RequestHandler = async () => {
	const projectList = await db
		.select({
			id: projects.id,
			name: projects.name,
			description: projects.description,
			status: projects.status,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
			// Correlated subqueries use the literal outer table name: drizzle renders ${projects.id}
			// unqualified, which would bind to the inner table's own id column.
			paperCount: numeric(sql`(SELECT COUNT(*) FROM papers WHERE papers.project_id = projects.id)`),
			keywordCount: numeric(sql`(SELECT COUNT(*) FROM project_keywords WHERE project_keywords.project_id = projects.id)`)
		})
		.from(projects)
		.orderBy(desc(projects.createdAt));

	return json({ projects: projectList });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const description = typeof body.description === 'string' ? body.description.trim() : '';

	if (!name || !description) {
		return json({ error: 'Name and description are required' }, { status: 400 });
	}

	const [project] = await db.insert(projects).values({ name, description }).returning();

	return json({ project }, { status: 201 });
};
