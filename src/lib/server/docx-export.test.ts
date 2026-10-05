import { describe, expect, it } from 'vitest';
import { markdownToDocx, outputToDocx, splitTableRow } from './docx-export';

describe('splitTableRow', () => {
	it('splits on unescaped pipes only', () => {
		expect(splitTableRow('| A \\| B | C |')).toEqual(['A | B', 'C']);
	});
});

describe('markdownToDocx', () => {
	it('builds a document from tables, lists, code and notes', async () => {
		const md = [
			'# Title',
			'> A note',
			'',
			'| Col | Other |',
			'| :--- | ---: |',
			'| a \\| b | 0 |',
			'',
			'1. first',
			'2. second',
			'',
			'Paragraph with a lone * star and **bold**.',
			'',
			'1. restarts',
			'```json',
			'{"a": 1}',
			'```',
			'---'
		].join('\n');
		const buffer = await markdownToDocx(md);
		expect(buffer.subarray(0, 2).toString()).toBe('PK'); // .docx is a zip
	});

	it('renders structured outputs (e.g. PRISMA) instead of empty headings', async () => {
		const buffer = await outputToDocx({
			title: 'PRISMA Flow Diagram',
			contentJson: JSON.stringify({ identification: { records_identified: 15 } })
		});
		expect(buffer.length).toBeGreaterThan(1000);
	});
});
