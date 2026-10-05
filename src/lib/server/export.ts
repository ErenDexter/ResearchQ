/**
 * Export service — CSV, BibTeX, JSON export for paper collections.
 */

import { db } from './db';
import { papers } from './db/schema';
import { asc } from 'drizzle-orm';
import { buildPaperWhere, type PaperFilters } from './paper-filters';
import { loadPaperRelations } from './paper-relations';
import { screeningDecision, screeningSourceLabel } from '$lib/screening';

export interface EnrichedPaper {
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
	relevanceSource: string | null;
	publisher: string | null;
	venueType: string | null;
	authors: string[];
	authorKeywords: string[];
	tags: Record<string, string>;
}

async function getEnrichedPapers(filters: PaperFilters): Promise<EnrichedPaper[]> {
	const paperList = await db
		.select()
		.from(papers)
		.where(buildPaperWhere(filters))
		.orderBy(asc(papers.publicationYear), asc(papers.title));

	const relations = await loadPaperRelations(paperList.map((p) => p.id));

	return paperList.map((p) => {
		const venue = relations.venues.get(p.id);
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
			relevanceSource: p.relevanceSource,
			publisher: venue?.publisher ?? null,
			venueType: venue?.type ?? null,
			authors: (relations.authors.get(p.id) ?? []).map((a) => a.name),
			authorKeywords: relations.keywords.get(p.id) ?? [],
			tags: relations.tags.get(p.id) ?? {}
		};
	});
}

// ─── CSV ────────────────────────────────────────────────────────────

/**
 * Quotes a CSV field when needed, and neutralises values that spreadsheet
 * apps would execute as formulas (titles/abstracts come from external data).
 */
export function escapeCSV(value: string | null | undefined): string {
	if (!value) return '';
	let str = value;
	if (/^[=+@\t\r]/.test(str) || /^-[^\d\s]/.test(str)) str = `'${str}`;
	if (/[",\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export async function exportToCSV(filters: PaperFilters): Promise<string> {
	const enriched = await getEnrichedPapers(filters);

	const headers = [
		'Title', 'DOI', 'Year', 'Authors', 'Journal/Venue', 'Database/Publisher',
		'Region', 'Platform/Domain', 'Summary', 'Methodology', 'Target Population',
		'Keywords', 'Relevant', 'Screening Decision By', 'URL'
	];

	const rows = enriched.map((p) =>
		[
			escapeCSV(p.title),
			escapeCSV(p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : ''),
			String(p.publicationYear || ''),
			escapeCSV(p.authors.join('; ')),
			escapeCSV(p.journalName),
			escapeCSV(p.publisher),
			escapeCSV(p.focusedRegion),
			escapeCSV(p.platformDomain),
			escapeCSV(p.summary),
			escapeCSV(p.methodologySummary),
			escapeCSV(p.targetPopulation),
			escapeCSV(p.authorKeywords.join('; ')),
			{ included: 'Yes', excluded: 'No', not_screened: 'Not screened' }[screeningDecision(p.isRelevant)],
			escapeCSV(p.isRelevant === null ? '' : screeningSourceLabel(p.relevanceSource)),
			escapeCSV(p.paperUrl)
		].join(',')
	);

	return [headers.join(','), ...rows].join('\n');
}

// ─── BibTeX ─────────────────────────────────────────────────────────

const LATEX_SPECIALS: Record<string, string> = {
	'\\': '\\textbackslash{}',
	'{': '\\{',
	'}': '\\}',
	'&': '\\&',
	'%': '\\%',
	$: '\\$',
	'#': '\\#',
	_: '\\_',
	'~': '\\textasciitilde{}',
	'^': '\\textasciicircum{}'
};

/** Escapes LaTeX special characters so field values can't break a .bib file. */
export function escapeBibtex(value: string): string {
	return value
		.replace(/[\\{}&%$#_~^]/g, (c) => LATEX_SPECIALS[c])
		.replace(/\s+/g, ' ')
		.trim();
}

/** Verbatim-ish fields (url, doi) must not contain braces, which would unbalance the entry. */
function bibtexVerbatim(value: string): string {
	return value.replace(/[{}]/g, '').trim();
}

function bibtexAuthor(name: string): string {
	const escaped = escapeBibtex(name);
	// A literal " and " inside one name (e.g. an organisation) would split it into two authors.
	return /\sand\s/i.test(escaped) ? `{${escaped}}` : escaped;
}

/** Maps an OpenAlex source type to a BibTeX entry type and the field that names the venue. */
export function bibtexEntryType(venueType: string | null, hasVenueName: boolean): { type: string; venueField: string } {
	switch (venueType) {
		case 'conference':
			return { type: 'inproceedings', venueField: 'booktitle' };
		case 'book series':
		case 'ebook platform':
		case 'book':
			return { type: 'incollection', venueField: 'booktitle' };
		case 'repository':
			return { type: 'misc', venueField: 'howpublished' };
		case 'journal':
			return { type: 'article', venueField: 'journal' };
		default:
			return hasVenueName ? { type: 'article', venueField: 'journal' } : { type: 'misc', venueField: 'howpublished' };
	}
}

export function toBibTeX(enriched: EnrichedPaper[]): string {
	const usedKeys = new Map<string, number>();

	return enriched
		.map((p) => {
			const baseKey = p.doi ? p.doi.replace(/[^a-zA-Z0-9]/g, '_') : `paper_${p.id.slice(0, 8)}`;
			const seen = usedKeys.get(baseKey) ?? 0;
			usedKeys.set(baseKey, seen + 1);
			const key = seen === 0 ? baseKey : `${baseKey}_${seen + 1}`;

			const { type, venueField } = bibtexEntryType(p.venueType, !!p.journalName);

			const fields = [
				`  title = {${escapeBibtex(p.title)}}`,
				p.authors.length > 0 ? `  author = {${p.authors.map(bibtexAuthor).join(' and ')}}` : null,
				p.journalName ? `  ${venueField} = {${escapeBibtex(p.journalName)}}` : null,
				p.publisher ? `  publisher = {${escapeBibtex(p.publisher)}}` : null,
				p.publicationYear ? `  year = {${p.publicationYear}}` : null,
				p.doi ? `  doi = {${bibtexVerbatim(p.doi)}}` : null,
				p.paperUrl ? `  url = {${bibtexVerbatim(p.paperUrl)}}` : null,
				p.abstract ? `  abstract = {${escapeBibtex(p.abstract)}}` : null
			].filter(Boolean);

			return `@${type}{${key},\n${fields.join(',\n')}\n}`;
		})
		.join('\n\n');
}

export async function exportToBibTeX(filters: PaperFilters): Promise<string> {
	return toBibTeX(await getEnrichedPapers(filters));
}

// ─── JSON ───────────────────────────────────────────────────────────

export async function exportToJSON(filters: PaperFilters): Promise<string> {
	const enriched = await getEnrichedPapers(filters);
	return JSON.stringify(enriched, null, 2);
}
