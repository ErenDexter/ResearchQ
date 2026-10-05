/**
 * LLM-powered project setup wizard.
 * Takes a project name + description, uses Gemini to generate
 * keywords, analysis dimensions, and relevance criteria.
 */

import { z } from 'zod';
import { generateStructured, MalformedLlmOutputError } from './llm';
import { buildProjectSetupPrompt } from './prompts';

export interface ProjectSetupResult {
	keywords: string[];
	dimensions: { name: string; label: string; description: string }[];
	relevanceDefinition: string;
	relevanceCriteria: { relevant: string[]; notRelevant: string[] };
}

const setupSchema = z.object({
	keywords: z.array(z.string()),
	dimensions: z.array(
		z.object({
			name: z.string(),
			label: z.string(),
			description: z.string()
		})
	),
	relevanceDefinition: z.string(),
	relevanceCriteria: z.object({
		relevant: z.array(z.string()),
		notRelevant: z.array(z.string())
	})
});

export async function generateProjectSetup(
	name: string,
	description: string
): Promise<ProjectSetupResult> {
	let result: z.infer<typeof setupSchema>;
	try {
		result = await generateStructured(setupSchema, buildProjectSetupPrompt(name, description));
	} catch (err) {
		if (err instanceof MalformedLlmOutputError) {
			throw new Error('Failed to generate project setup. Please try again.');
		}
		throw err;
	}

	const keywords = [...new Set(result.keywords.map((k) => k.toLowerCase().trim()).filter(Boolean))];
	if (keywords.length === 0) throw new Error('No keywords generated. Please try again.');
	if (result.dimensions.length === 0) throw new Error('No dimensions generated. Please try again.');

	return {
		keywords,
		dimensions: result.dimensions.map((d, i) => ({
			name: d.name.trim() || `dimension_${i}`,
			label: d.label.trim() || d.name.trim() || `Dimension ${i + 1}`,
			description: d.description.trim()
		})),
		relevanceDefinition: result.relevanceDefinition,
		relevanceCriteria: result.relevanceCriteria
	};
}
