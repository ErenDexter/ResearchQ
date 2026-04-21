/**
 * Loads a project's PromptContext from the database.
 * Used by jobs, API endpoints, and anywhere Gemini needs project context.
 */

import { db } from './db';
import {
	projects,
	projectDimensions,
	projectKeywords,
	keywords
} from './db/schema';
import { eq, and } from 'drizzle-orm';
import type { PromptContext } from './prompts';

export async function loadPromptContext(projectId: string): Promise<PromptContext> {
	const [project] = await db
		.select()
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);

	if (!project) throw new Error(`Project not found: ${projectId}`);

	const dims = await db
		.select()
		.from(projectDimensions)
		.where(eq(projectDimensions.projectId, projectId))
		.orderBy(projectDimensions.position);

	const baseKws = await db
		.select({ term: keywords.term })
		.from(projectKeywords)
		.innerJoin(keywords, eq(projectKeywords.keywordId, keywords.id))
		.where(
			and(
				eq(projectKeywords.projectId, projectId),
				eq(projectKeywords.isBaseKeyword, true)
			)
		);

	let criteria = { relevant: [] as string[], notRelevant: [] as string[] };
	try {
		if (project.relevanceCriteria) {
			criteria = JSON.parse(project.relevanceCriteria);
		}
	} catch {
		// use defaults
	}

	return {
		projectName: project.name,
		projectDescription: project.description,
		relevanceDefinition: project.relevanceDefinition || '',
		relevanceCriteria: criteria,
		dimensions: dims.map((d) => ({
			name: d.name,
			label: d.label,
			description: d.description || ''
		})),
		baseKeywords: baseKws.map((k) => k.term)
	};
}

/**
 * Get the first active project's ID (used when no project is specified).
 */
export async function getDefaultProjectId(): Promise<string | null> {
	const [project] = await db
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.status, 'active'))
		.limit(1);

	return project?.id || null;
}
