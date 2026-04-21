import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { searchJobs } from '$lib/server/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { jobQueue } from '$lib/server/job-queue';
import { getDefaultProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());

	const conditions = [];
	if (projectId) {
		conditions.push(eq(searchJobs.projectId, projectId));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;
	const jobs = await db.select().from(searchJobs).where(where).orderBy(desc(searchJobs.createdAt));
	return json(jobs);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { type, query, projectId: reqProjectId, maxResults, dateFrom, dateTo, skipRelevanceFilter } = body;

	if (!type || !query) {
		return json({ error: 'type and query are required' }, { status: 400 });
	}

	const validTypes = ['journal', 'author', 'topic', 'citation_forward', 'citation_backward', 'related', 'snowball', 'database'];
	if (!validTypes.includes(type)) {
		return json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
	}

	const projectId = reqProjectId || (await getDefaultProjectId());
	if (!projectId) {
		return json({ error: 'No project found. Create a project first.' }, { status: 400 });
	}

	// Create job record
	const jobId = crypto.randomUUID();
	await db.insert(searchJobs).values({
		id: jobId,
		projectId,
		type,
		query: query.trim(),
		status: 'pending',
		maxResults: type === 'database' && maxResults ? Number(maxResults) : null,
		dateFrom: dateFrom || null,
		dateTo: dateTo || null,
		skipRelevanceFilter: !!skipRelevanceFilter
	});

	// Enqueue job (sequential processing prevents rate limit issues)
	jobQueue.enqueue(jobId);

	const job = await db.select().from(searchJobs).where(eq(searchJobs.id, jobId)).limit(1);
	return json(job[0], { status: 201 });
};
