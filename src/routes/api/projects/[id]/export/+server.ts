import type { RequestHandler } from './$types';
import { exportToCSV, exportToBibTeX, exportToJSON } from '$lib/server/export';

export const GET: RequestHandler = async ({ params, url }) => {
	const format = url.searchParams.get('format') || 'csv';
	const filters = {
		projectId: params.id,
		relevantOnly: url.searchParams.get('relevant') === 'true',
		yearMin: url.searchParams.get('yearMin') ? parseInt(url.searchParams.get('yearMin')!) : undefined,
		yearMax: url.searchParams.get('yearMax') ? parseInt(url.searchParams.get('yearMax')!) : undefined,
		region: url.searchParams.get('region') || undefined,
		platform: url.searchParams.get('platform') || undefined,
		search: url.searchParams.get('search') || undefined
	};

	let content: string;
	let contentType: string;
	let filename: string;

	switch (format) {
		case 'bibtex':
			content = await exportToBibTeX(filters);
			contentType = 'application/x-bibtex';
			filename = 'papers.bib';
			break;
		case 'json':
			content = await exportToJSON(filters);
			contentType = 'application/json';
			filename = 'papers.json';
			break;
		default:
			content = await exportToCSV(filters);
			contentType = 'text/csv';
			filename = 'papers.csv';
	}

	return new Response(content, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
