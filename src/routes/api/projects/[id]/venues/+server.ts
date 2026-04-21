import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { analyzeVenues } from '$lib/server/venue-analysis';

/**
 * GET: Returns analyzed venue list for a project.
 * POST: Triggers a fresh venue analysis.
 */
export const GET: RequestHandler = async ({ params }) => {
	const venues = await analyzeVenues(params.id);
	return json({ venues });
};

export const POST: RequestHandler = async ({ params }) => {
	const venues = await analyzeVenues(params.id);
	return json({ venues, refreshed: true });
};
