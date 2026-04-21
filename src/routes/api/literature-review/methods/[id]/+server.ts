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
	const updates: Record<string, unknown> = {};

	if (body.name !== undefined) updates.name = body.name.trim();
	if (body.description !== undefined) updates.description = body.description.trim();
	if (body.type !== undefined) updates.type = body.type;
	if (body.domain !== undefined) updates.domain = body.domain;

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
