import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	projectReviews,
	reviewMethodologies,
	methodologyPhases,
	reviewPhaseProgress,
	reviewOutputs
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { OUTPUT_TYPE_REGISTRY } from '$lib/server/literature-review';

export const GET: RequestHandler = async ({ params, url }) => {
	const format = url.searchParams.get('format') || 'markdown';

	const [review] = await db
		.select()
		.from(projectReviews)
		.where(eq(projectReviews.id, params.reviewId))
		.limit(1);

	if (!review) return new Response('Review not found', { status: 404 });

	const [methodology] = await db
		.select()
		.from(reviewMethodologies)
		.where(eq(reviewMethodologies.id, review.methodologyId))
		.limit(1);

	const phases = await db
		.select()
		.from(methodologyPhases)
		.where(eq(methodologyPhases.methodologyId, review.methodologyId))
		.orderBy(methodologyPhases.position);

	const progress = await db
		.select()
		.from(reviewPhaseProgress)
		.where(eq(reviewPhaseProgress.projectReviewId, review.id));

	const outputs = await db
		.select()
		.from(reviewOutputs)
		.where(eq(reviewOutputs.projectReviewId, review.id));

	const progressMap = new Map(progress.map((p) => [p.phaseId, p]));
	const outputsByPhase = new Map<string, typeof outputs>();
	for (const o of outputs) {
		const key = o.phaseId || '__unassigned';
		if (!outputsByPhase.has(key)) outputsByPhase.set(key, []);
		outputsByPhase.get(key)!.push(o);
	}

	// Build markdown report
	let md = `# ${methodology?.name || 'Literature Review'} Report\n\n`;
	md += `**Methodology:** ${methodology?.name} (${methodology?.type})\n`;
	md += `**Status:** ${review.status}\n`;
	md += `**Started:** ${review.startedAt || '—'}\n`;
	md += `**Generated:** ${new Date().toISOString().slice(0, 10)}\n\n`;
	md += '---\n\n';

	for (const phase of phases) {
		const prog = progressMap.get(phase.id);
		const statusEmoji = prog?.status === 'completed' ? '[x]' : prog?.status === 'in_progress' ? '[-]' : '[ ]';

		md += `## Phase ${phase.position + 1}: ${phase.name} ${statusEmoji}\n\n`;
		if (phase.description) md += `${phase.description}\n\n`;
		if (prog?.notes) md += `**Notes:** ${prog.notes}\n\n`;

		// Include outputs for this phase
		const phaseOutputs = outputsByPhase.get(phase.id) || [];
		for (const output of phaseOutputs) {
			const meta = OUTPUT_TYPE_REGISTRY[output.outputType];
			md += `### ${output.title}\n\n`;

			if (output.contentMarkdown) {
				md += output.contentMarkdown + '\n\n';
			} else if (output.contentJson) {
				try {
					const data = JSON.parse(output.contentJson);
					if (data.columns && data.rows) {
						// Render as markdown table
						md += '| ' + data.columns.join(' | ') + ' |\n';
						md += '| ' + data.columns.map(() => '---').join(' | ') + ' |\n';
						for (const row of data.rows.slice(0, 50)) {
							const vals = data.columns.map((col: string) => {
								const key = col.toLowerCase().replace(/[^a-z]/g, '');
								return String(row[key] || row[col] || Object.values(row)[data.columns.indexOf(col)] || '—');
							});
							md += '| ' + vals.join(' | ') + ' |\n';
						}
						md += '\n';
					} else {
						md += '```json\n' + JSON.stringify(data, null, 2) + '\n```\n\n';
					}
				} catch {
					md += '*(structured data available in JSON format)*\n\n';
				}
			}
		}
	}

	// Unassigned outputs
	const unassigned = outputsByPhase.get('__unassigned') || [];
	if (unassigned.length > 0) {
		md += '## Additional Outputs\n\n';
		for (const output of unassigned) {
			md += `### ${output.title}\n\n`;
			if (output.contentMarkdown) md += output.contentMarkdown + '\n\n';
		}
	}

	if (format === 'docx') {
		const { reviewToDocx } = await import('$lib/server/docx-export');
		const buffer = await reviewToDocx(md);
		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': 'attachment; filename="review-report.docx"'
			}
		});
	}

	if (format === 'json') {
		return new Response(JSON.stringify({ review, methodology, phases, progress, outputs }, null, 2), {
			headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="review-report.json"' }
		});
	}

	return new Response(md, {
		headers: { 'Content-Type': 'text/markdown', 'Content-Disposition': 'attachment; filename="review-report.md"' }
	});
};
