import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeVenues } from '$lib/server/venue-analysis';

/**
 * GET: Returns the project's venues ranked by volume and relevance, with top authors.
 * Ranks are computed on read, so there is nothing to refresh.
 */
export const GET: RequestHandler = async ({ params }) => {
	const venues = await analyzeVenues(params.id);
	return json({ venues });
};
