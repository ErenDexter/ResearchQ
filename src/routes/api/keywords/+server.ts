import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { keywords, projectKeywords } from '$lib/server/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { getDefaultProjectId } from '$lib/server/project-context';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());

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
			.orderBy(desc(projectKeywords.isBaseKeyword));

		return json(keywordList);
	}

	// Fallback: return all keywords
	const keywordList = await db
		.select()
		.from(keywords)
		.orderBy(desc(keywords.isBaseKeyword));

	return json(keywordList);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { term, projectId: reqProjectId } = body;

	if (!term || typeof term !== 'string' || term.trim().length === 0) {
		return json({ error: 'Keyword term is required' }, { status: 400 });
	}

	const normalized = term.toLowerCase().trim();
	const projectId = reqProjectId || (await getDefaultProjectId());

	// Upsert into global keywords table
	let [existing] = await db
		.select({ id: keywords.id })
		.from(keywords)
		.where(eq(keywords.term, normalized))
		.limit(1);

	if (!existing) {
		[existing] = await db
			.insert(keywords)
			.values({ term: normalized, isBaseKeyword: false })
			.returning({ id: keywords.id });
	}

	// Link to project if projectId provided
	if (projectId) {
		try {
			await db.insert(projectKeywords).values({
				projectId,
				keywordId: existing.id,
				isBaseKeyword: false,
				relevanceScore: 0.8
			});
		} catch {
			// Already linked to this project
			return json({ error: 'Keyword already exists in this project' }, { status: 409 });
		}
	}

	return json({ id: existing.id, term: normalized }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	const projectId = url.searchParams.get('projectId') || (await getDefaultProjectId());

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
