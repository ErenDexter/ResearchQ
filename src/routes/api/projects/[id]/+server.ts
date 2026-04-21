import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	projects,
	projectDimensions,
	projectKeywords,
	keywords
} from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const [project] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, params.id))
		.limit(1);

	if (!project) {
		return json({ error: 'Project not found' }, { status: 404 });
	}

	const dims = await db
		.select()
		.from(projectDimensions)
		.where(eq(projectDimensions.projectId, params.id))
		.orderBy(projectDimensions.position);

	const kws = await db
		.select({
			id: projectKeywords.id,
			keywordId: projectKeywords.keywordId,
			term: keywords.term,
			isBaseKeyword: projectKeywords.isBaseKeyword,
			relevanceScore: projectKeywords.relevanceScore,
			usageCount: projectKeywords.usageCount
		})
		.from(projectKeywords)
		.innerJoin(keywords, eq(projectKeywords.keywordId, keywords.id))
		.where(eq(projectKeywords.projectId, params.id));

	return json({
		project,
		dimensions: dims,
		keywords: kws
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const updates: Record<string, unknown> = {};

	if (body.name !== undefined) updates.name = body.name.trim();
	if (body.description !== undefined) updates.description = body.description.trim();
	if (body.status !== undefined) updates.status = body.status;
	if (body.relevanceDefinition !== undefined) updates.relevanceDefinition = body.relevanceDefinition;
	if (body.relevanceCriteria !== undefined)
		updates.relevanceCriteria =
			typeof body.relevanceCriteria === 'string'
				? body.relevanceCriteria
				: JSON.stringify(body.relevanceCriteria);
	if (body.customPromptContext !== undefined) updates.customPromptContext = body.customPromptContext;

	updates.updatedAt = new Date().toISOString();

	await db.update(projects).set(updates).where(eq(projects.id, params.id));

	const [updated] = await db.select().from(projects).where(eq(projects.id, params.id)).limit(1);
	return json({ project: updated });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await db.delete(projects).where(eq(projects.id, params.id));
	return json({ success: true });
};
