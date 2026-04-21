import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { papers, paperAuthors, authors, paperKeywords, keywords, analysisTags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const paper = await db
		.select()
		.from(papers)
		.where(eq(papers.id, params.id))
		.limit(1);

	if (!paper.length) {
		return error(404, 'Paper not found');
	}

	const authorList = await db
		.select({
			id: authors.id,
			name: authors.name,
			orcid: authors.orcid,
			affiliation: authors.affiliation
		})
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.where(eq(paperAuthors.paperId, params.id))
		.orderBy(paperAuthors.position);

	const keywordList = await db
		.select({ term: keywords.term, isBase: keywords.isBaseKeyword })
		.from(paperKeywords)
		.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
		.where(eq(paperKeywords.paperId, params.id));

	const tags = await db
		.select({ dimension: analysisTags.dimension, value: analysisTags.value })
		.from(analysisTags)
		.where(eq(analysisTags.paperId, params.id));

	return json({
		...paper[0],
		authors: authorList,
		keywords: keywordList,
		analysisTags: tags
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();

	const allowedFields = [
		'summary',
		'methodologySummary',
		'targetPopulation',
		'focusedRegion',
		'platformDomain',
		'isRelevant'
	];

	const updates: Record<string, unknown> = {};
	for (const field of allowedFields) {
		if (field in body) {
			updates[field] = body[field];
		}
	}

	if (Object.keys(updates).length === 0) {
		return json({ error: 'No valid fields to update' }, { status: 400 });
	}

	await db.update(papers).set(updates).where(eq(papers.id, params.id));

	const updated = await db.select().from(papers).where(eq(papers.id, params.id)).limit(1);
	return json(updated[0]);
};

export const DELETE: RequestHandler = async ({ params }) => {
	await db.delete(papers).where(eq(papers.id, params.id));
	return json({ success: true });
};
