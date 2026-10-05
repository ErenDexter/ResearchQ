import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { keywords, projectKeywords } from '$lib/server/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { resolveProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	if (projectId) {
		// Return project-scoped keywords with relevance info
		const keywordList = await db
			.select({
				id: keywords.id,
				term: keywords.term,
				isBaseKeyword: projectKeywords.isBaseKeyword,
				relevanceScore: projectKeywords.relevanceScore,
				usageCount: projectKeywords.usageCount,
				projectKeywordId: projectKeywords.id
			})
			.from(projectKeywords)
			.innerJoin(keywords, eq(projectKeywords.keywordId, keywords.id))
			.where(eq(projectKeywords.projectId, projectId))
			.orderBy(desc(projectKeywords.isBaseKeyword), keywords.term);

		return json(keywordList);
	}

	// Fallback: return all keywords
	const keywordList = await db
		.select()
		.from(keywords)
		.orderBy(desc(keywords.isBaseKeyword), keywords.term);

	return json(keywordList);
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const { term, projectId: reqProjectId } = body;

	if (!term || typeof term !== 'string' || term.trim().length === 0) {
		return json({ error: 'Keyword term is required' }, { status: 400 });
	}

	const normalized = term.toLowerCase().trim();
	const projectId = await resolveProjectId(reqProjectId, cookies);

	// Upsert into global keywords table
	await db
		.insert(keywords)
		.values({ term: normalized, isBaseKeyword: false })
		.onConflictDoNothing({ target: keywords.term });
	const [existing] = await db
		.select({ id: keywords.id })
		.from(keywords)
		.where(eq(keywords.term, normalized))
		.limit(1);

	// Link to project if projectId provided
	if (projectId) {
		const linked = await db
			.insert(projectKeywords)
			.values({
				projectId,
				keywordId: existing.id,
				isBaseKeyword: false,
				relevanceScore: 0.8
			})
			.onConflictDoNothing()
			.returning({ id: projectKeywords.id });

		if (linked.length === 0) {
			return json({ error: 'Keyword already exists in this project' }, { status: 409 });
		}
	}

	return json({ id: existing.id, term: normalized }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url, cookies }) => {
	const id = url.searchParams.get('id');
	const projectId = await resolveProjectId(url.searchParams.get('projectId'), cookies);

	if (!id) {
		return json({ error: 'Keyword id is required' }, { status: 400 });
	}

	if (projectId) {
		// Remove the project-keyword link (not the keyword itself)
		await db
			.delete(projectKeywords)
			.where(
				and(
					eq(projectKeywords.keywordId, id),
					eq(projectKeywords.projectId, projectId)
				)
			);
	} else {
		await db.delete(keywords).where(eq(keywords.id, id));
	}

	return json({ success: true });
};
