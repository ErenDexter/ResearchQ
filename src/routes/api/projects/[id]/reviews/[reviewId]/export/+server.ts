import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	reviewMethodologies,
	methodologyPhases,
	reviewPhaseProgress,
	reviewOutputs
} from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getReviewInProject } from '$lib/server/literature-review';
import { outputBodyToMarkdown } from '$lib/review-output';

export const GET: RequestHandler = async ({ params, url }) => {
	const format = url.searchParams.get('format') || 'markdown';

	const review = await getReviewInProject(params.id, params.reviewId);
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
		.where(eq(reviewOutputs.projectReviewId, review.id))
		.orderBy(desc(reviewOutputs.generatedAt));

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

	const renderOutput = (output: (typeof outputs)[number]) =>
		`### ${output.title}\n\n${outputBodyToMarkdown(output, 4)}\n\n`;

	for (const phase of phases) {
		const prog = progressMap.get(phase.id);
		const statusEmoji = prog?.status === 'completed' ? '[x]' : prog?.status === 'in_progress' ? '[-]' : '[ ]';

		md += `## Phase ${phase.position + 1}: ${phase.name} ${statusEmoji}\n\n`;
		if (phase.description) md += `${phase.description}\n\n`;
		if (prog?.notes) md += `**Notes:** ${prog.notes}\n\n`;

		for (const output of outputsByPhase.get(phase.id) || []) md += renderOutput(output);
	}

	// Outputs not attached to a phase (all formats, not just markdown)
	const unassigned = outputsByPhase.get('__unassigned') || [];
	if (unassigned.length > 0) {
		md += '## Additional Outputs\n\n';
		for (const output of unassigned) md += renderOutput(output);
	}

	if (format === 'docx') {
		const { reviewToDocx } = await import('$lib/server/docx-export');
		const buffer = await reviewToDocx(md);
		return new Response(new Uint8Array(buffer), {
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
		headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="review-report.md"' }
	});
};
