import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateOutput } from '$lib/server/literature-review';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const { outputType, phaseId } = body;

	if (!outputType) {
		return json({ error: 'outputType is required' }, { status: 400 });
	}

	try {
		const output = await generateOutput(params.id, params.reviewId, outputType, phaseId);
		return json({ output }, { status: 201 });
	} catch (e) {
		console.error('Output generation failed:', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Generation failed' },
			{ status: 500 }
		);
	}
};
