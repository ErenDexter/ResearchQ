import type { RequestHandler } from './$types';
import { exportToCSV, exportToBibTeX, exportToJSON } from '$lib/server/export';
import { parsePaperFilters } from '$lib/server/paper-filters';

export const GET: RequestHandler = async ({ params, url }) => {
	const format = url.searchParams.get('format') || 'csv';
	const filters = parsePaperFilters(params.id, url.searchParams);

	let content: string;
	let contentType: string;
	let filename: string;

	switch (format) {
		case 'bibtex':
			content = await exportToBibTeX(filters);
			contentType = 'application/x-bibtex; charset=utf-8';
			filename = 'papers.bib';
			break;
		case 'json':
			content = await exportToJSON(filters);
			contentType = 'application/json; charset=utf-8';
			filename = 'papers.json';
			break;
		default:
			content = await exportToCSV(filters);
			contentType = 'text/csv; charset=utf-8';
			filename = 'papers.csv';
	}

	return new Response(content, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
