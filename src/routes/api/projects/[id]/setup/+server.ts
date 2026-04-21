import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import {
	projects,
	projectDimensions,
	projectKeywords,
	keywords
} from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateProjectSetup } from '$lib/server/project-setup';

/**
 * POST: Run the LLM-powered setup wizard for a project.
 * Generates keywords, dimensions, and relevance criteria.
 * Can be called on a new project or to re-generate for an existing one.
 */
export const POST: RequestHandler = async ({ params }) => {
	const [project] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, params.id))
		.limit(1);

	if (!project) {
		return json({ error: 'Project not found' }, { status: 404 });
	}

	try {
		const setup = await generateProjectSetup(project.name, project.description);

		// Update project with relevance info
		await db
			.update(projects)
			.set({
				relevanceDefinition: setup.relevanceDefinition,
				relevanceCriteria: JSON.stringify(setup.relevanceCriteria),
				updatedAt: new Date().toISOString()
			})
			.where(eq(projects.id, params.id));

		// Clear and re-insert dimensions
		await db.delete(projectDimensions).where(eq(projectDimensions.projectId, params.id));
		for (let i = 0; i < setup.dimensions.length; i++) {
			const dim = setup.dimensions[i];
			await db.insert(projectDimensions).values({
				projectId: params.id,
				name: dim.name,
				label: dim.label,
				description: dim.description,
				position: i
			});
		}

		// Insert keywords (shared keyword entities + project links)
		for (const term of setup.keywords) {
			const normalized = term.toLowerCase().trim();
			if (!normalized) continue;

			// Upsert into global keywords table
			let [existing] = await db
				.select({ id: keywords.id })
				.from(keywords)
				.where(eq(keywords.term, normalized))
				.limit(1);

			if (!existing) {
				[existing] = await db
					.insert(keywords)
					.values({ term: normalized, isBaseKeyword: false })
					.returning({ id: keywords.id });
			}

			// Link to project (ignore if already linked)
			try {
				await db.insert(projectKeywords).values({
					projectId: params.id,
					keywordId: existing.id,
					isBaseKeyword: true,
					relevanceScore: 1.0
				});
			} catch {
				// unique constraint violation — already linked
			}
		}

		// Reload the final state
		const dims = await db
			.select()
			.from(projectDimensions)
			.where(eq(projectDimensions.projectId, params.id))
			.orderBy(projectDimensions.position);

		const kws = await db
			.select({ term: keywords.term })
			.from(projectKeywords)
			.innerJoin(keywords, eq(projectKeywords.keywordId, keywords.id))
			.where(eq(projectKeywords.projectId, params.id));

		return json({
			success: true,
			setup: {
				relevanceDefinition: setup.relevanceDefinition,
				relevanceCriteria: setup.relevanceCriteria,
				dimensions: dims,
				keywords: kws.map((k) => k.term)
			}
		});
	} catch (e) {
		console.error('Project setup failed:', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Setup failed' },
			{ status: 500 }
		);
	}
};
