/**
 * Batched loading of a paper's related rows (authors, keywords, analysis
 * tags, venue). Replaces per-paper queries (N+1) with one query per relation
 * per chunk of paper IDs.
 */

import { db } from './db';
import {
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	analysisTags,
	paperJournals,
	journals
} from './db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { chunk } from './db/helpers';

export interface PaperAuthor {
	id: string;
	name: string;
	orcid: string | null;
	affiliation: string | null;
}

export interface PaperVenue {
	name: string;
	publisher: string | null;
	type: string | null;
}

export interface PaperRelations {
	authors: Map<string, PaperAuthor[]>;
	keywords: Map<string, string[]>;
	tags: Map<string, Record<string, string>>;
	venues: Map<string, PaperVenue>;
}

type Include = Partial<Record<keyof PaperRelations, boolean>>;

const ALL: Include = { authors: true, keywords: true, tags: true, venues: true };

export async function loadPaperRelations(
	paperIds: string[],
	include: Include = ALL
): Promise<PaperRelations> {
	const result: PaperRelations = {
		authors: new Map(),
		keywords: new Map(),
		tags: new Map(),
		venues: new Map()
	};

	for (const ids of chunk([...new Set(paperIds)])) {
		if (ids.length === 0) continue;

		const [authorRows, keywordRows, tagRows, venueRows] = await Promise.all([
			include.authors
				? db
						.select({
							paperId: paperAuthors.paperId,
							id: authors.id,
							name: authors.name,
							orcid: authors.orcid,
							affiliation: authors.affiliation
						})
						.from(paperAuthors)
						.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
						.where(inArray(paperAuthors.paperId, ids))
						.orderBy(asc(paperAuthors.position))
				: [],
			include.keywords
				? db
						.select({ paperId: paperKeywords.paperId, term: keywords.term })
						.from(paperKeywords)
						.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
						.where(inArray(paperKeywords.paperId, ids))
				: [],
			include.tags
				? db
						.select({
							paperId: analysisTags.paperId,
							dimension: analysisTags.dimension,
							value: analysisTags.value
						})
						.from(analysisTags)
						.where(inArray(analysisTags.paperId, ids))
				: [],
			include.venues
				? db
						.select({
							paperId: paperJournals.paperId,
							name: journals.name,
							publisher: journals.publisher,
							type: journals.type
						})
						.from(paperJournals)
						.innerJoin(journals, eq(paperJournals.journalId, journals.id))
						.where(inArray(paperJournals.paperId, ids))
				: []
		]);

		for (const { paperId, ...author } of authorRows) {
			const list = result.authors.get(paperId) ?? [];
			list.push(author);
			result.authors.set(paperId, list);
		}
		for (const { paperId, term } of keywordRows) {
			const list = result.keywords.get(paperId) ?? [];
			list.push(term);
			result.keywords.set(paperId, list);
		}
		for (const { paperId, dimension, value } of tagRows) {
			const tags = result.tags.get(paperId) ?? {};
			tags[dimension] = value;
			result.tags.set(paperId, tags);
		}
		for (const { paperId, ...venue } of venueRows) {
			if (!result.venues.has(paperId)) result.venues.set(paperId, venue);
		}
	}

	return result;
}
