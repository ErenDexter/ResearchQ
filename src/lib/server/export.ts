/**
 * Export service — CSV, BibTeX, JSON export for paper collections.
 */

import { db } from './db';
import {
	papers,
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	analysisTags,
	paperJournals,
	journals
} from './db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface ExportFilters {
	projectId: string;
	relevantOnly?: boolean;
	yearMin?: number;
	yearMax?: number;
	region?: string;
	platform?: string;
	search?: string;
}

interface EnrichedPaper {
	id: string;
	title: string;
	doi: string | null;
	publicationYear: number | null;
	abstract: string | null;
	summary: string | null;
	methodologySummary: string | null;
	targetPopulation: string | null;
	focusedRegion: string | null;
	platformDomain: string | null;
	journalName: string | null;
	paperUrl: string | null;
	isRelevant: boolean | null;
	authors: string[];
	authorKeywords: string[];
	tags: Record<string, string>;
}

async function getEnrichedPapers(filters: ExportFilters): Promise<EnrichedPaper[]> {
	const conditions = [eq(papers.projectId, filters.projectId)];

	if (filters.relevantOnly) conditions.push(eq(papers.isRelevant, true));
	if (filters.yearMin) conditions.push(sql`${papers.publicationYear} >= ${filters.yearMin}`);
	if (filters.yearMax) conditions.push(sql`${papers.publicationYear} <= ${filters.yearMax}`);
	if (filters.region) conditions.push(sql`${papers.focusedRegion} LIKE ${'%' + filters.region + '%'}`);
	if (filters.platform) conditions.push(sql`${papers.platformDomain} LIKE ${'%' + filters.platform + '%'}`);
	if (filters.search) conditions.push(sql`${papers.title} LIKE ${'%' + filters.search + '%'}`);

	const paperList = await db
		.select()
		.from(papers)
		.where(and(...conditions))
		.orderBy(papers.publicationYear);

	return Promise.all(
		paperList.map(async (p) => {
			const [authorList, kwList, tagList, journalInfo] = await Promise.all([
				db
					.select({ name: authors.name })
					.from(paperAuthors)
					.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
					.where(eq(paperAuthors.paperId, p.id))
					.orderBy(paperAuthors.position),
				db
					.select({ term: keywords.term })
					.from(paperKeywords)
					.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
					.where(eq(paperKeywords.paperId, p.id)),
				db
					.select({ dimension: analysisTags.dimension, value: analysisTags.value })
					.from(analysisTags)
					.where(eq(analysisTags.paperId, p.id)),
				db
					.select({ publisher: journals.publisher })
					.from(paperJournals)
					.innerJoin(journals, eq(paperJournals.journalId, journals.id))
					.where(eq(paperJournals.paperId, p.id))
					.limit(1)
			]);

			const tags: Record<string, string> = {};
			for (const t of tagList) {
				tags[t.dimension] = t.value;
			}

			return {
				id: p.id,
				title: p.title,
				doi: p.doi,
				publicationYear: p.publicationYear,
				abstract: p.abstract,
				summary: p.summary,
				methodologySummary: p.methodologySummary,
				targetPopulation: p.targetPopulation,
				focusedRegion: p.focusedRegion,
				platformDomain: p.platformDomain,
				journalName: p.journalName,
				paperUrl: p.paperUrl,
				isRelevant: p.isRelevant,
				publisher: journalInfo[0]?.publisher || null,
				authors: authorList.map((a) => a.name),
				authorKeywords: kwList.map((k) => k.term),
				tags
			};
		})
	);
}

function escapeCSV(str: string): string {
	if (!str) return '';
	if (str.includes('"') || str.includes(',') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export async function exportToCSV(filters: ExportFilters): Promise<string> {
	const enriched = await getEnrichedPapers(filters);

	const headers = [
		'Title', 'DOI', 'Year', 'Authors', 'Journal/Venue', 'Database/Publisher',
		'Region', 'Platform/Domain', 'Summary', 'Methodology', 'Target Population',
		'Keywords', 'Relevant', 'URL'
	];

	const rows = enriched.map((p) =>
		[
			escapeCSV(p.title),
			p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : '',
			String(p.publicationYear || ''),
			escapeCSV(p.authors.join('; ')),
			escapeCSV(p.journalName || ''),
			escapeCSV(p.publisher || ''),
			escapeCSV(p.focusedRegion || ''),
			escapeCSV(p.platformDomain || ''),
			escapeCSV(p.summary || ''),
			escapeCSV(p.methodologySummary || ''),
			escapeCSV(p.targetPopulation || ''),
			escapeCSV(p.authorKeywords.join('; ')),
			p.isRelevant ? 'Yes' : 'No',
			p.paperUrl || ''
		].join(',')
	);

	return [headers.join(','), ...rows].join('\n');
}

export async function exportToBibTeX(filters: ExportFilters): Promise<string> {
	const enriched = await getEnrichedPapers(filters);

	return enriched
		.map((p) => {
			const key = p.doi
				? p.doi.replace(/[^a-zA-Z0-9]/g, '_')
				: `paper_${p.id.slice(0, 8)}`;

			const fields = [
				`  title = {${p.title}}`,
				p.authors.length > 0 ? `  author = {${p.authors.join(' and ')}}` : null,
				p.journalName ? `  journal = {${p.journalName}}` : null,
				p.publicationYear ? `  year = {${p.publicationYear}}` : null,
				p.doi ? `  doi = {${p.doi}}` : null,
				p.paperUrl ? `  url = {${p.paperUrl}}` : null,
				p.abstract ? `  abstract = {${p.abstract.slice(0, 500)}}` : null
			].filter(Boolean);

			return `@article{${key},\n${fields.join(',\n')}\n}`;
		})
		.join('\n\n');
}

export async function exportToJSON(filters: ExportFilters): Promise<string> {
	const enriched = await getEnrichedPapers(filters);
	return JSON.stringify(enriched, null, 2);
}
