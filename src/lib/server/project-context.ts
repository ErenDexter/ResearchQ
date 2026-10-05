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
import { eq, and, desc } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import type { PromptContext } from './prompts';
import { PROJECT_COOKIE } from '$lib/project-cookie';

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
 * The project used when none is specified: the newest active project, or the
 * newest project of any status. Matches the sidebar's default selection.
 */
export async function getDefaultProjectId(): Promise<string | null> {
	const list = await db
		.select({ id: projects.id, status: projects.status })
		.from(projects)
		.orderBy(desc(projects.createdAt));

	return (list.find((p) => p.status === 'active') ?? list[0])?.id ?? null;
}

async function projectExists(id: string): Promise<boolean> {
	const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).limit(1);
	return !!row;
}

/**
 * Resolves the project a request is about: an explicit id (query param or
 * body), then the sidebar's project cookie, then the default project.
 */
export async function resolveProjectId(
	explicit: string | null | undefined,
	cookies?: Cookies
): Promise<string | null> {
	if (explicit) return explicit;
	const fromCookie = cookies?.get(PROJECT_COOKIE);
	if (fromCookie && (await projectExists(fromCookie))) return fromCookie;
	return getDefaultProjectId();
}
