import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewOutputs } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { outputToDocx } from '$lib/server/docx-export';

export const GET: RequestHandler = async ({ params }) => {
	const [output] = await db
		.select()
		.from(reviewOutputs)
		.where(eq(reviewOutputs.id, params.outputId))
		.limit(1);

	if (!output) {
		return new Response('Output not found', { status: 404 });
	}

	const buffer = await outputToDocx({
		title: output.title,
		contentMarkdown: output.contentMarkdown,
		contentJson: output.contentJson
	});

	const filename = `${output.title.replace(/\s+/g, '-').toLowerCase()}.docx`;

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
