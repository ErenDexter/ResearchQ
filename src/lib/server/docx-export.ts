/**
 * DOCX export — converts markdown content and structured data into Word documents.
 * Uses the `docx` npm package for server-side generation.
 *
 * Structured (JSON) outputs are first rendered to markdown with the shared
 * review-output renderer, so DOCX, Markdown and the UI show the same tables.
 */

import {
	Document,
	Paragraph,
	TextRun,
	Table,
	TableRow,
	TableCell,
	HeadingLevel,
	Packer,
	AlignmentType,
	LevelFormat,
	WidthType,
	BorderStyle
} from 'docx';
import { outputBodyToMarkdown, type StoredOutput } from '$lib/review-output';

// ─── Markdown to DOCX ─────────────────────────────────────────────

/** Splits inline **bold** / *italic* markup into runs; stray asterisks are kept as text. */
export function parseInlineFormatting(text: string): TextRun[] {
	const runs: TextRun[] = [];
	const regex = /\*\*(.+?)\*\*|\*([^*\s][^*]*?)\*|([^*]+|\*)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match[1] !== undefined) {
			runs.push(new TextRun({ text: match[1], bold: true }));
		} else if (match[2] !== undefined) {
			runs.push(new TextRun({ text: match[2], italics: true }));
		} else if (match[3] !== undefined) {
			runs.push(new TextRun({ text: match[3] }));
		}
	}

	if (runs.length === 0) {
		runs.push(new TextRun({ text }));
	}

	return runs;
}

/** Splits a markdown table row on unescaped pipes and unescapes `\|`. */
export function splitTableRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, '')
		.replace(/(?<!\\)\|$/, '')
		.split(/(?<!\\)\|/)
		.map((c) => c.trim().replace(/\\\|/g, '|'));
}

const TABLE_SEPARATOR = /^\|?(\s*:?-{3,}:?\s*\|)+\s*(:?-{3,}:?\s*)?$/;

function markdownTableToDocxTable(lines: string[]): Table {
	const rows = lines.filter((l) => !TABLE_SEPARATOR.test(l.trim())).map(splitTableRow);

	if (rows.length === 0) {
		return new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('No data')] })] })] });
	}

	const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
	const borders = { top: border, bottom: border, left: border, right: border };
	const width = Math.max(...rows.map((r) => r.length));

	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: rows.map((cells, rowIdx) =>
			new TableRow({
				tableHeader: rowIdx === 0,
				children: Array.from({ length: width }, (_, i) => cells[i] ?? '').map(
					(cell) =>
						new TableCell({
							borders,
							children: [
								new Paragraph({
									children: [new TextRun({ text: cell, bold: rowIdx === 0, size: 20 })]
								})
							]
						})
				)
			})
		)
	});
}

export async function markdownToDocx(md: string): Promise<Buffer> {
	const lines = md.split(/\r?\n/);
	const children: (Paragraph | Table)[] = [];
	let i = 0;
	// Each separate numbered list gets its own numbering instance so it restarts at 1.
	let listInstance = 0;
	let previousWasNumbered = false;

	while (i < lines.length) {
		const line = lines[i];
		let isNumbered = false;

		// Fenced code block
		if (line.trim().startsWith('```')) {
			i++;
			while (i < lines.length && !lines[i].trim().startsWith('```')) {
				children.push(new Paragraph({ children: [new TextRun({ text: lines[i], font: 'Courier New', size: 18 })] }));
				i++;
			}
			i++; // closing fence
			previousWasNumbered = false;
			continue;
		}

		// Headings
		if (line.startsWith('#### ')) {
			children.push(new Paragraph({ text: line.slice(5), heading: HeadingLevel.HEADING_4 }));
		} else if (line.startsWith('### ')) {
			children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
		} else if (line.startsWith('## ')) {
			children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
		} else if (line.startsWith('# ')) {
			children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
		}
		// Table: collect consecutive | lines
		else if (line.trim().startsWith('|')) {
			const tableLines: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith('|')) {
				tableLines.push(lines[i]);
				i++;
			}
			children.push(markdownTableToDocxTable(tableLines));
			previousWasNumbered = false;
			continue; // skip i++ at end
		}
		// Block quote (used for notes)
		else if (line.startsWith('> ')) {
			children.push(new Paragraph({ children: parseInlineFormatting(line.slice(2)), indent: { left: 360 } }));
		}
		// Horizontal rule (checked before bullets: "---" would otherwise look like a list item)
		else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
			children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
		}
		// Bullet points
		else if (/^\s*[-*]\s+/.test(line)) {
			const text = line.replace(/^\s*[-*]\s+/, '');
			children.push(
				new Paragraph({
					children: parseInlineFormatting(text),
					bullet: { level: 0 }
				})
			);
		}
		// Numbered list
		else if (/^\s*\d+\.\s+/.test(line)) {
			isNumbered = true;
			if (!previousWasNumbered) listInstance++;
			const text = line.replace(/^\s*\d+\.\s+/, '');
			children.push(
				new Paragraph({
					children: parseInlineFormatting(text),
					numbering: { reference: 'default-numbering', level: 0, instance: listInstance }
				})
			);
		}
		// Empty line
		else if (line.trim() === '') {
			children.push(new Paragraph({ text: '' }));
			// A blank line inside a list doesn't end it; anything else does.
			isNumbered = previousWasNumbered;
		}
		// Regular paragraph
		else {
			children.push(new Paragraph({ children: parseInlineFormatting(line) }));
		}

		previousWasNumbered = isNumbered;
		i++;
	}

	const doc = new Document({
		numbering: {
			config: [
				{
					reference: 'default-numbering',
					levels: [
						{
							level: 0,
							format: LevelFormat.DECIMAL,
							text: '%1.',
							alignment: AlignmentType.LEFT
						}
					]
				}
			]
		},
		sections: [{ children }]
	});

	return Buffer.from(await Packer.toBuffer(doc));
}

// ─── Single output to DOCX ────────────────────────────────────────

export async function outputToDocx(output: StoredOutput): Promise<Buffer> {
	return markdownToDocx(`# ${output.title}\n\n${outputBodyToMarkdown(output, 2)}`);
}

// ─── Full review report to DOCX ───────────────────────────────────

export async function reviewToDocx(markdownReport: string): Promise<Buffer> {
	return markdownToDocx(markdownReport);
}
