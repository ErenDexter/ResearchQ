/**
 * DOCX export — converts markdown content and structured data into Word documents.
 * Uses the `docx` npm package for server-side generation.
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
	WidthType,
	BorderStyle
} from 'docx';

// ─── Markdown to DOCX ─────────────────────────────────────────────

function parseInlineFormatting(text: string): TextRun[] {
	const runs: TextRun[] = [];
	// Simple bold/italic parsing: **bold**, *italic*
	const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match[2]) {
			// **bold**
			runs.push(new TextRun({ text: match[2], bold: true }));
		} else if (match[3]) {
			// *italic*
			runs.push(new TextRun({ text: match[3], italics: true }));
		} else if (match[4]) {
			runs.push(new TextRun({ text: match[4] }));
		}
	}

	if (runs.length === 0) {
		runs.push(new TextRun({ text }));
	}

	return runs;
}

function markdownTableToDocxTable(lines: string[]): Table {
	// Parse markdown table lines into rows
	const rows: string[][] = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith('|') && !trimmed.match(/^\|[\s-|]+\|$/)) {
			const cells = trimmed
				.split('|')
				.slice(1, -1)
				.map((c) => c.trim());
			rows.push(cells);
		}
	}

	if (rows.length === 0) {
		return new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph('No data')] })] })] });
	}

	const noBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
	const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: rows.map((cells, rowIdx) =>
			new TableRow({
				children: cells.map(
					(cell) =>
						new TableCell({
							borders,
							children: [
								new Paragraph({
									children: rowIdx === 0
										? [new TextRun({ text: cell, bold: true, size: 20 })]
										: [new TextRun({ text: cell, size: 20 })]
								})
							]
						})
				)
			})
		)
	});
}

export async function markdownToDocx(md: string): Promise<Buffer> {
	const lines = md.split('\n');
	const children: (Paragraph | Table)[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Headings
		if (line.startsWith('### ')) {
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
			continue; // skip i++ at end
		}
		// Bullet points
		else if (line.match(/^\s*[-*]\s+/)) {
			const text = line.replace(/^\s*[-*]\s+/, '');
			children.push(
				new Paragraph({
					children: parseInlineFormatting(text),
					bullet: { level: 0 }
				})
			);
		}
		// Numbered list
		else if (line.match(/^\s*\d+\.\s+/)) {
			const text = line.replace(/^\s*\d+\.\s+/, '');
			children.push(
				new Paragraph({
					children: parseInlineFormatting(text),
					numbering: { reference: 'default-numbering', level: 0 }
				})
			);
		}
		// Horizontal rule
		else if (line.match(/^-{3,}$/)) {
			children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
		}
		// Empty line
		else if (line.trim() === '') {
			children.push(new Paragraph({ text: '' }));
		}
		// Regular paragraph
		else {
			children.push(new Paragraph({ children: parseInlineFormatting(line) }));
		}

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
							format: 'decimal' as any,
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

export async function outputToDocx(output: {
	title: string;
	contentMarkdown?: string | null;
	contentJson?: string | null;
}): Promise<Buffer> {
	// If markdown content exists, convert it
	if (output.contentMarkdown) {
		return markdownToDocx(`# ${output.title}\n\n${output.contentMarkdown}`);
	}

	// If JSON content, build tables
	if (output.contentJson) {
		try {
			const data = JSON.parse(output.contentJson);
			const children: (Paragraph | Table)[] = [
				new Paragraph({ text: output.title, heading: HeadingLevel.HEADING_1 }),
				new Paragraph({ text: '' })
			];

			if (data.columns && data.rows) {
				// Standard table format
				children.push(jsonDataToDocxTable(data.columns, data.rows));
			} else if (typeof data === 'object' && !Array.isArray(data)) {
				// Named arrays (bibliometric, etc.)
				for (const [key, value] of Object.entries(data)) {
					const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
					children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_2 }));

					if (Array.isArray(value) && value.length > 0) {
						const cols = Object.keys(value[0]);
						children.push(jsonDataToDocxTable(cols, value));
					}
					children.push(new Paragraph({ text: '' }));
				}
			}

			const doc = new Document({ sections: [{ children }] });
			return Buffer.from(await Packer.toBuffer(doc));
		} catch {
			// Fallback: dump as text
			return markdownToDocx(`# ${output.title}\n\n\`\`\`\n${output.contentJson}\n\`\`\``);
		}
	}

	return markdownToDocx(`# ${output.title}\n\nNo content available.`);
}

function jsonDataToDocxTable(columns: string[], rows: any[]): Table {
	const noBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
	const borders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

	const headerRow = new TableRow({
		children: columns.map(
			(col) =>
				new TableCell({
					borders,
					children: [
						new Paragraph({
							children: [new TextRun({ text: String(col), bold: true, size: 20 })]
						})
					]
				})
		)
	});

	const dataRows = rows.slice(0, 100).map(
		(row: any) =>
			new TableRow({
				children: columns.map((col) => {
					const key = Object.keys(row).find(
						(k) => k === col || k.toLowerCase() === col.toLowerCase().replace(/[^a-z]/g, '')
					);
					const val = String(row[key || col] ?? Object.values(row)[columns.indexOf(col)] ?? '—');
					return new TableCell({
						borders,
						children: [new Paragraph({ children: [new TextRun({ text: val.slice(0, 200), size: 20 })] })]
					});
				})
			})
	);

	return new Table({
		width: { size: 100, type: WidthType.PERCENTAGE },
		rows: [headerRow, ...dataRows]
	});
}

// ─── Full review report to DOCX ───────────────────────────────────

export async function reviewToDocx(markdownReport: string): Promise<Buffer> {
	return markdownToDocx(markdownReport);
}
