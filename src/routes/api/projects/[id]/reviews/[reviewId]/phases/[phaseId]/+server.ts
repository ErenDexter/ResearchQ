import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewPhaseProgress } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getReviewInProject } from '$lib/server/literature-review';

const PHASE_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'];

export const PATCH: RequestHandler = async ({ params, request }) => {
	if (!(await getReviewInProject(params.id, params.reviewId))) {
		return json({ error: 'Review not found' }, { status: 404 });
	}

	const body = await request.json();
	const updates: Record<string, unknown> = {};

	if (body.status !== undefined) {
		if (!PHASE_STATUSES.includes(body.status)) {
			return json({ error: `status must be one of: ${PHASE_STATUSES.join(', ')}` }, { status: 400 });
		}
		updates.status = body.status;
		updates.completedAt = body.status === 'completed' ? new Date().toISOString() : null;
	}
	if (body.notes !== undefined) {
		if (body.notes !== null && typeof body.notes !== 'string') {
			return json({ error: 'notes must be a string' }, { status: 400 });
		}
		updates.notes = body.notes;
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}

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
