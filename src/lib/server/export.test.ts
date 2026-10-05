import { describe, expect, it } from 'vitest';
import { bibtexEntryType, escapeBibtex, escapeCSV, toBibTeX, type EnrichedPaper } from './export';

function paper(overrides: Partial<EnrichedPaper> = {}): EnrichedPaper {
	return {
		id: '12345678-aaaa',
		title: 'Fairness & Bias: 50% of_cases',
		doi: '10.1145/1234_5',
		publicationYear: 2022,
		abstract: null,
		summary: null,
		methodologySummary: null,
		targetPopulation: null,
		focusedRegion: null,
		platformDomain: null,
		journalName: 'Proc. of {Things}',
		paperUrl: 'https://example.org/p?x=1',
		isRelevant: true,
		relevanceSource: 'ai',
		publisher: 'ACM',
		venueType: 'conference',
		authors: ['Ada Lovelace', 'Department of Health and Human Services'],
		authorKeywords: [],
		tags: {},
		...overrides
	};
}

describe('escapeBibtex', () => {
	it('escapes LaTeX special characters', () => {
		expect(escapeBibtex('A & B 50% #1 $x$ a_b {c} ~ ^ \\')).toBe(
			'A \\& B 50\\% \\#1 \\$x\\$ a\\_b \\{c\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}'
		);
	});
});

describe('toBibTeX', () => {
	it('produces a balanced, escaped entry with a type matching the venue', () => {
		const bib = toBibTeX([paper()]);
		expect(bib).toMatch(/^@inproceedings\{10_1145_1234_5,/);
		expect(bib).toContain('title = {Fairness \\& Bias: 50\\% of\\_cases}');
		expect(bib).toContain('booktitle = {Proc. of \\{Things\\}}');
		expect(bib).toContain('author = {Ada Lovelace and {Department of Health and Human Services}}');
		expect(bib).toContain('doi = {10.1145/1234_5}');

		const opens = (bib.match(/(?<!\\)\{/g) ?? []).length;
		const closes = (bib.match(/(?<!\\)\}/g) ?? []).length;
		expect(opens).toBe(closes);
	});

	it('gives duplicate DOIs distinct keys', () => {
		const bib = toBibTeX([paper(), paper({ id: 'other' })]);
		expect(bib).toContain('{10_1145_1234_5,');
		expect(bib).toContain('{10_1145_1234_5_2,');
	});

	it('maps venue types', () => {
		expect(bibtexEntryType('journal', true)).toEqual({ type: 'article', venueField: 'journal' });
		expect(bibtexEntryType('repository', true)).toEqual({
			type: 'misc',
			venueField: 'howpublished'
		});
		expect(bibtexEntryType(null, false).type).toBe('misc');
	});
});

describe('escapeCSV', () => {
	it('quotes fields containing separators, quotes or line breaks', () => {
		expect(escapeCSV('a,b')).toBe('"a,b"');
		expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCSV('line\r\nbreak')).toBe('"line\r\nbreak"');
		expect(escapeCSV(null)).toBe('');
	});

	it('neutralises spreadsheet formulas but keeps negative numbers', () => {
		expect(escapeCSV('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(escapeCSV('+cmd')).toBe("'+cmd");
		expect(escapeCSV('-5')).toBe('-5');
	});
});
