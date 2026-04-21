import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewPhaseProgress } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const updates: Record<string, unknown> = {};

	if (body.status !== undefined) {
		updates.status = body.status;
		if (body.status === 'completed') {
			updates.completedAt = new Date().toISOString();
		}
	}
	if (body.notes !== undefined) updates.notes = body.notes;

	await db
		.update(reviewPhaseProgress)
		.set(updates)
		.where(
			and(
				eq(reviewPhaseProgress.projectReviewId, params.reviewId),
				eq(reviewPhaseProgress.phaseId, params.phaseId)
			)
		);

	return json({ success: true });
};
