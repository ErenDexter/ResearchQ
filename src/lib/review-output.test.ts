import { describe, expect, it } from 'vitest';
import {
	blocksToMarkdown,
	formatCell,
	jsonOutputToBlocks,
	normalizeColumns,
	outputBodyToMarkdown
} from './review-output';

describe('formatCell', () => {
	it('keeps zero and false, and only blanks missing values', () => {
		expect(formatCell(0)).toBe('0');
		expect(formatCell(false)).toBe('false');
		expect(formatCell(null)).toBe('—');
		expect(formatCell('')).toBe('—');
		expect(formatCell(['a', 'b'])).toBe('a; b');
	});
});

describe('normalizeColumns', () => {
	it('uses explicit keys', () => {
		expect(normalizeColumns([{ key: 'totalScore', label: 'Total' }], [])).toEqual([
			{ key: 'totalScore', label: 'Total' }
		]);
	});

	it('maps legacy label columns to row keys by name, then position', () => {
		const rows = [{ title: 'T', year: 2020, platform: 'Web' }];
		expect(normalizeColumns(['Title', 'Year', 'Platform/Domain'], rows).map((c) => c.key)).toEqual([
			'title',
			'year',
			'platform'
		]);
	});
});

describe('jsonOutputToBlocks', () => {
	it('renders a PRISMA flow as key/value sections with its note', () => {
		const blocks = jsonOutputToBlocks({
			identification: { records_identified: 15 },
			screening: { records_excluded: 0 },
			note: 'Heads up'
		});
		expect(blocks[0]).toEqual({ kind: 'note', text: 'Heads up' });
		expect(blocks).toContainEqual({
			kind: 'keyValue',
			title: 'Identification',
			entries: [['Records Identified', '15']]
		});
		expect(blocks).toContainEqual({
			kind: 'keyValue',
			title: 'Screening',
			entries: [['Records Excluded', '0']]
		});
	});

	it('flattens a coding framework into a table', () => {
		const [block] = jsonOutputToBlocks({
			categories: [
				{
					name: 'Cat',
					description: 'd',
					codes: [{ name: 'Code', description: 'cd', studies: ['Paper A'] }]
				}
			]
		});
		expect(block).toMatchObject({
			kind: 'table',
			rows: [{ category: 'Cat', code: 'Code', studies: ['Paper A'] }]
		});
	});

	it('renders named arrays (bibliometrics) as titled tables', () => {
		const blocks = jsonOutputToBlocks({ byYear: [{ year: 2020, count: 3 }] });
		expect(blocks[0]).toMatchObject({ kind: 'table', title: 'By Year' });
	});
});

describe('markdown rendering', () => {
	it('escapes pipes and newlines in cells and keeps every row', () => {
		const rows = Array.from({ length: 120 }, (_, i) => ({ title: `A | B ${i}\nC`, score: 0 }));
		const md = outputBodyToMarkdown({
			title: 'T',
			contentJson: JSON.stringify({
				columns: [
					{ key: 'title', label: 'Title' },
					{ key: 'score', label: 'Score' }
				],
				rows
			})
		});
		expect(md.split('\n')).toHaveLength(122);
		expect(md).toContain('| A \\| B 0 C | 0 |');
	});

	it('renders key/value blocks as two-column tables', () => {
		expect(blocksToMarkdown([{ kind: 'keyValue', title: 'S', entries: [['K', 'V']] }], 2)).toBe(
			'## S\n\n| Item | Value |\n| --- | --- |\n| K | V |'
		);
	});
});
