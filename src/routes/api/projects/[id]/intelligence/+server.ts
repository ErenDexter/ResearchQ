import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	analyzeAuthorNetwork,
	analyzeTrends,
	analyzeGaps,
	findDuplicates
} from '$lib/server/research-intelligence';

export const GET: RequestHandler = async ({ params, url }) => {
	const section = url.searchParams.get('section');

	// Allow fetching individual sections for performance
	if (section === 'authors') {
		return json(await analyzeAuthorNetwork(params.id));
	}
	if (section === 'trends') {
		return json(await analyzeTrends(params.id));
	}
	if (section === 'gaps') {
		return json(await analyzeGaps(params.id));
	}
	if (section === 'duplicates') {
		return json({ duplicates: await findDuplicates(params.id) });
	}

	// Return all sections
	const [authorNetwork, trends, gaps, duplicates] = await Promise.all([
		analyzeAuthorNetwork(params.id),
		analyzeTrends(params.id),
		analyzeGaps(params.id),
		findDuplicates(params.id)
	]);

	return json({
		authorNetwork,
		trends,
		gaps,
		duplicates
	});
};
