import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewOutputs } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { outputToDocx } from '$lib/server/docx-export';
import { getReviewInProject } from '$lib/server/literature-review';

export const GET: RequestHandler = async ({ params }) => {
	if (!(await getReviewInProject(params.id, params.reviewId))) {
		return new Response('Review not found', { status: 404 });
	}

	const [output] = await db
		.select()
		.from(reviewOutputs)
		.where(and(eq(reviewOutputs.id, params.outputId), eq(reviewOutputs.projectReviewId, params.reviewId)))
		.limit(1);

	if (!output) {
		return new Response('Output not found', { status: 404 });
	}

	const buffer = await outputToDocx({
		title: output.title,
		contentMarkdown: output.contentMarkdown,
		contentJson: output.contentJson
	});

	const filename = `${output.title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}.docx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
