import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewOutputs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const outputs = await db
		.select()
		.from(reviewOutputs)
		.where(eq(reviewOutputs.projectReviewId, params.reviewId));

	return json({ outputs });
};

export const DELETE: RequestHandler = async ({ url, params }) => {
	const outputId = url.searchParams.get('outputId');
	if (!outputId) return json({ error: 'outputId required' }, { status: 400 });

	await db.delete(reviewOutputs).where(eq(reviewOutputs.id, outputId));
	return json({ success: true });
};
