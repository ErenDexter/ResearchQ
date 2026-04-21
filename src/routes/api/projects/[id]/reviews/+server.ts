import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	projectReviews,
	reviewMethodologies,
	methodologyPhases,
	reviewPhaseProgress
} from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const reviews = await db
		.select({
			id: projectReviews.id,
			projectId: projectReviews.projectId,
			methodologyId: projectReviews.methodologyId,
			status: projectReviews.status,
			startedAt: projectReviews.startedAt,
			completedAt: projectReviews.completedAt,
			createdAt: projectReviews.createdAt,
			methodologyName: reviewMethodologies.name,
			methodologyType: reviewMethodologies.type
		})
		.from(projectReviews)
		.innerJoin(reviewMethodologies, eq(projectReviews.methodologyId, reviewMethodologies.id))
		.where(eq(projectReviews.projectId, params.id))
		.orderBy(desc(projectReviews.createdAt));

	return json({ reviews });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { methodologyId } = body;

	if (!methodologyId) {
		return json({ error: 'methodologyId is required' }, { status: 400 });
	}

	// Verify methodology exists
	const [method] = await db
		.select()
		.from(reviewMethodologies)
		.where(eq(reviewMethodologies.id, methodologyId))
		.limit(1);

	if (!method) {
		return json({ error: 'Methodology not found' }, { status: 404 });
	}

	// Create the project review
	const [review] = await db
		.insert(projectReviews)
		.values({
			projectId: params.id,
			methodologyId,
			status: 'setup',
			startedAt: new Date().toISOString()
		})
		.returning();

	// Create phase progress entries for each methodology phase
	const phases = await db
		.select()
		.from(methodologyPhases)
		.where(eq(methodologyPhases.methodologyId, methodologyId))
		.orderBy(methodologyPhases.position);

	for (const phase of phases) {
		await db.insert(reviewPhaseProgress).values({
			projectReviewId: review.id,
			phaseId: phase.id,
			status: 'pending'
		});
	}

	return json({ review, phasesCreated: phases.length }, { status: 201 });
};
