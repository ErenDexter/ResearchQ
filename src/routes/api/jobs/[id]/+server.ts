import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { searchJobs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { jobQueue } from '$lib/server/job-queue';

export const GET: RequestHandler = async ({ params }) => {
	const job = await db
		.select()
		.from(searchJobs)
		.where(eq(searchJobs.id, params.id))
		.limit(1);

	if (!job.length) {
		return error(404, 'Job not found');
	}

	return json(job[0]);
};

// Retry a failed job — resumes from the last completed phase
export const POST: RequestHandler = async ({ params }) => {
	const [job] = await db
		.select()
		.from(searchJobs)
		.where(eq(searchJobs.id, params.id))
		.limit(1);

	if (!job) return error(404, 'Job not found');
	if (job.status !== 'failed') {
		return json({ error: 'Only failed jobs can be retried' }, { status: 400 });
	}

	// Reset status but keep completedPhases so it resumes from where it left off
	await db.update(searchJobs).set({
		status: 'pending',
		error: null,
		completedAt: null,
		retryCount: (job.retryCount || 0) + 1,
		statusMessage: 'Retrying — will resume from last checkpoint...'
	}).where(eq(searchJobs.id, params.id));

	// Re-enqueue
	jobQueue.enqueue(params.id);

	const [updated] = await db.select().from(searchJobs).where(eq(searchJobs.id, params.id)).limit(1);
	return json(updated);
};
