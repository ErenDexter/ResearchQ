import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewMethodologies, methodologyPhases } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const [method] = await db
		.select()
		.from(reviewMethodologies)
		.where(eq(reviewMethodologies.id, params.id))
		.limit(1);

	if (!method) return json({ error: 'Methodology not found' }, { status: 404 });

	const phases = await db
		.select()
		.from(methodologyPhases)
		.where(eq(methodologyPhases.methodologyId, params.id))
		.orderBy(methodologyPhases.position);

	return json({
		method,
		phases: phases.map((p) => ({
			...p,
			expectedOutputs: p.expectedOutputs ? JSON.parse(p.expectedOutputs) : []
		}))
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const updates: Record<string, string> = {};

	for (const field of ['name', 'description', 'type', 'domain'] as const) {
		if (body[field] === undefined) continue;
		if (typeof body[field] !== 'string') {
			return json({ error: `${field} must be a string` }, { status: 400 });
		}
		updates[field] = body[field].trim();
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}

	await db.update(reviewMethodologies).set(updates).where(eq(reviewMethodologies.id, params.id));

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	// Don't allow deleting built-in methods
	const [method] = await db
		.select({ isBuiltIn: reviewMethodologies.isBuiltIn })
		.from(reviewMethodologies)
		.where(eq(reviewMethodologies.id, params.id))
		.limit(1);

	if (method?.isBuiltIn) {
		return json({ error: 'Cannot delete built-in methodologies' }, { status: 403 });
	}

	await db.delete(reviewMethodologies).where(eq(reviewMethodologies.id, params.id));
	return json({ success: true });
};
