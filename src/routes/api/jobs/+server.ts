import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { projects, searchJobs } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { jobQueue } from '$lib/server/job-queue';
import { OPTIONAL_QUERY_TYPES, SEARCH_TYPES, type SearchType } from '$lib/server/jobs';
import { resolveProjectId } from '$lib/server/project-context';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET: RequestHandler = async ({ url, cookies }) => {
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	const jobs = await db
		.select()
		.from(searchJobs)
		.where(projectId ? eq(searchJobs.projectId, projectId) : undefined)
		.orderBy(desc(searchJobs.createdAt));
	return json(jobs);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const { type, projectId: reqProjectId, maxResults, dateFrom, dateTo, skipRelevanceFilter } = body;
	const query = typeof body.query === 'string' ? body.query.trim() : '';

	if (!(SEARCH_TYPES as readonly string[]).includes(type)) {
		return json({ error: `type must be one of: ${SEARCH_TYPES.join(', ')}` }, { status: 400 });
	}
	if (!query && !OPTIONAL_QUERY_TYPES.includes(type as SearchType)) {
		return json({ error: 'query is required for this search type' }, { status: 400 });
	}
	if ((dateFrom && !DATE_RE.test(dateFrom)) || (dateTo && !DATE_RE.test(dateTo))) {
		return json({ error: 'dateFrom and dateTo must be YYYY-MM-DD' }, { status: 400 });
	}

	const projectId = await resolveProjectId(reqProjectId, cookies);
	if (!projectId) {
		return json({ error: 'No project found. Create a project first.' }, { status: 400 });
	}
	const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
	if (!project) {
		return json({ error: 'Project not found' }, { status: 404 });
	}

	const cappedMax =
		type === 'database' && maxResults ? Math.min(Math.max(Math.round(Number(maxResults)) || 200, 50), 10000) : null;

	// Create job record
	const jobId = crypto.randomUUID();
	await db.insert(searchJobs).values({
		id: jobId,
		projectId,
		type,
		query,
		status: 'pending',
		maxResults: cappedMax,
		dateFrom: dateFrom || null,
		dateTo: dateTo || null,
		skipRelevanceFilter: !!skipRelevanceFilter
	});

	// Enqueue job (sequential processing prevents rate limit issues)
	jobQueue.enqueue(jobId);

	const job = await db.select().from(searchJobs).where(eq(searchJobs.id, jobId)).limit(1);
	return json(job[0], { status: 201 });
};
