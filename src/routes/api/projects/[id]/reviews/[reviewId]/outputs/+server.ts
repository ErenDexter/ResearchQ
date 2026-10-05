import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewOutputs } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getReviewInProject } from '$lib/server/literature-review';

export const GET: RequestHandler = async ({ params }) => {
	if (!(await getReviewInProject(params.id, params.reviewId))) {
		return json({ error: 'Review not found' }, { status: 404 });
	}

	const outputs = await db
		.select()
		.from(reviewOutputs)
		.where(eq(reviewOutputs.projectReviewId, params.reviewId))
		.orderBy(desc(reviewOutputs.generatedAt));

	return json({ outputs });
};

export const DELETE: RequestHandler = async ({ url, params }) => {
	const outputId = url.searchParams.get('outputId');
	if (!outputId) return json({ error: 'outputId required' }, { status: 400 });
	if (!(await getReviewInProject(params.id, params.reviewId))) {
		return json({ error: 'Review not found' }, { status: 404 });
	}

	await db
		.delete(reviewOutputs)
		.where(and(eq(reviewOutputs.id, outputId), eq(reviewOutputs.projectReviewId, params.reviewId)));
	return json({ success: true });
};
