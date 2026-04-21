import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	projectReviews,
	reviewMethodologies,
	methodologyPhases,
	reviewPhaseProgress,
	reviewOutputs
} from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const [review] = await db
		.select()
		.from(projectReviews)
		.where(
			and(
				eq(projectReviews.id, params.reviewId),
				eq(projectReviews.projectId, params.id)
			)
		)
		.limit(1);

	if (!review) return json({ error: 'Review not found' }, { status: 404 });

	// Get methodology details
	const [methodology] = await db
		.select()
		.from(reviewMethodologies)
		.where(eq(reviewMethodologies.id, review.methodologyId))
		.limit(1);

	// Get phases with progress
	const phases = await db
		.select()
		.from(methodologyPhases)
		.where(eq(methodologyPhases.methodologyId, review.methodologyId))
		.orderBy(methodologyPhases.position);

	const progress = await db
		.select()
		.from(reviewPhaseProgress)
		.where(eq(reviewPhaseProgress.projectReviewId, review.id));

	const progressMap = new Map(progress.map((p) => [p.phaseId, p]));

	const phasesWithProgress = phases.map((phase) => {
		const prog = progressMap.get(phase.id);
		return {
			...phase,
			expectedOutputs: phase.expectedOutputs ? JSON.parse(phase.expectedOutputs) : [],
			progress: prog
				? { status: prog.status, notes: prog.notes, completedAt: prog.completedAt, id: prog.id }
				: { status: 'pending', notes: null, completedAt: null, id: null }
		};
	});

	// Get all outputs
	const outputs = await db
		.select()
		.from(reviewOutputs)
		.where(eq(reviewOutputs.projectReviewId, review.id));

	return json({
		review,
		methodology,
		phases: phasesWithProgress,
		outputs
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const updates: Record<string, unknown> = {};

	if (body.status !== undefined) {
		updates.status = body.status;
		if (body.status === 'in_progress' && !body.startedAt) {
			updates.startedAt = new Date().toISOString();
		}
		if (body.status === 'completed') {
			updates.completedAt = new Date().toISOString();
		}
	}
	if (body.config !== undefined) updates.config = JSON.stringify(body.config);

	await db
		.update(projectReviews)
		.set(updates)
		.where(
			and(
				eq(projectReviews.id, params.reviewId),
				eq(projectReviews.projectId, params.id)
			)
		);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params }) => {
	await db
		.delete(projectReviews)
		.where(
			and(
				eq(projectReviews.id, params.reviewId),
				eq(projectReviews.projectId, params.id)
			)
		);

	return json({ success: true });
};
