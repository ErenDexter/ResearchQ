import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	projects,
	projectDimensions,
	projectKeywords,
	keywords
} from '$lib/server/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const projectList = await db
		.select({
			id: projects.id,
			name: projects.name,
			description: projects.description,
			status: projects.status,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
			paperCount: sql<number>`(SELECT COUNT(*) FROM papers WHERE project_id = ${projects.id})`,
			keywordCount: sql<number>`(SELECT COUNT(*) FROM project_keywords WHERE project_id = ${projects.id})`
		})
		.from(projects)
		.orderBy(desc(projects.createdAt));

	return json({ projects: projectList });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { name, description } = body;

	if (!name || !description) {
		return json({ error: 'Name and description are required' }, { status: 400 });
	}

	const [project] = await db
		.insert(projects)
		.values({
			name: name.trim(),
			description: description.trim()
		})
		.returning();

	return json({ project }, { status: 201 });
};
