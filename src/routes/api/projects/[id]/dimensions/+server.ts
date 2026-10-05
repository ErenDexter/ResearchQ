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
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const label = typeof body.label === 'string' ? body.label.trim() : '';

	if (!name || !label) {
		return json({ error: 'Name and label are required' }, { status: 400 });
	}

	const [dim] = await db
		.insert(projectDimensions)
		.values({
			projectId: params.id,
			name,
			label,
			description: typeof body.description === 'string' ? body.description.trim() : '',
			position: Number.isInteger(body.position) ? body.position : 0
		})
		.returning();

	return json({ dimension: dim }, { status: 201 });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { dimensionId } = body;

	if (!dimensionId) {
		return json({ error: 'dimensionId is required' }, { status: 400 });
	}

	// Only these fields are editable — never id or projectId.
	const updates: Partial<{ name: string; label: string; description: string; position: number }> = {};
	for (const field of ['name', 'label', 'description'] as const) {
		if (typeof body[field] === 'string') updates[field] = body[field].trim();
	}
	if (Number.isInteger(body.position)) updates.position = body.position;

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}
	if (updates.name === '' || updates.label === '') {
		return json({ error: 'Name and label cannot be empty' }, { status: 400 });
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
