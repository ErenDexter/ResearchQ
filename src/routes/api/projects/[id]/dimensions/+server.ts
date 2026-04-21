import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projectDimensions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const dims = await db
		.select()
		.from(projectDimensions)
		.where(eq(projectDimensions.projectId, params.id))
		.orderBy(projectDimensions.position);

	return json({ dimensions: dims });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { name, label, description, position } = body;

	if (!name || !label) {
		return json({ error: 'Name and label are required' }, { status: 400 });
	}

	const [dim] = await db
		.insert(projectDimensions)
		.values({
			projectId: params.id,
			name: name.trim(),
			label: label.trim(),
			description: description?.trim() || '',
			position: position ?? 0
		})
		.returning();

	return json({ dimension: dim }, { status: 201 });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { dimensionId, ...updates } = body;

	if (!dimensionId) {
		return json({ error: 'dimensionId is required' }, { status: 400 });
	}

	await db
		.update(projectDimensions)
		.set(updates)
		.where(
			and(
				eq(projectDimensions.id, dimensionId),
				eq(projectDimensions.projectId, params.id)
			)
		);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const dimensionId = url.searchParams.get('dimensionId');

	if (!dimensionId) {
		return json({ error: 'dimensionId query param is required' }, { status: 400 });
	}

	await db
		.delete(projectDimensions)
		.where(
			and(
				eq(projectDimensions.id, dimensionId),
				eq(projectDimensions.projectId, params.id)
			)
		);

	return json({ success: true });
};
