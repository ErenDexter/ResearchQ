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
import { eq, and, desc } from 'drizzle-orm';

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

	// Get all outputs (newest first)
	const outputs = await db
		.select()
		.from(reviewOutputs)
		.where(eq(reviewOutputs.projectReviewId, review.id))
		.orderBy(desc(reviewOutputs.generatedAt));

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
		if (!['setup', 'in_progress', 'completed'].includes(body.status)) {
			return json({ error: 'status must be one of: setup, in_progress, completed' }, { status: 400 });
		}
		updates.status = body.status;
		if (body.status === 'in_progress' && !body.startedAt) {
			updates.startedAt = new Date().toISOString();
		}
		updates.completedAt = body.status === 'completed' ? new Date().toISOString() : null;
	}
	if (body.config !== undefined) updates.config = JSON.stringify(body.config);

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}

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
