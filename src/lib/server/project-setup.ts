/**
 * LLM-powered project setup wizard.
 * Takes a project name + description, uses Gemini to generate
 * keywords, analysis dimensions, and relevance criteria.
 */

import { generateText } from 'ai';
import { getModel } from './llm';
import { buildProjectSetupPrompt } from './prompts';

export interface ProjectSetupResult {
	keywords: string[];
	dimensions: { name: string; label: string; description: string }[];
	relevanceDefinition: string;
	relevanceCriteria: { relevant: string[]; notRelevant: string[] };
}

export async function generateProjectSetup(
	name: string,
	description: string
): Promise<ProjectSetupResult> {
	const prompt = buildProjectSetupPrompt(name, description);

	const { text } = await generateText({
		model: getModel(),
		prompt
	});

	const cleaned = text.trim().replace(/^```json?\s*/, '').replace(/```\s*$/, '');

	try {
		const result = JSON.parse(cleaned) as ProjectSetupResult;

		// Validate and normalize
		if (!Array.isArray(result.keywords) || result.keywords.length === 0) {
			throw new Error('No keywords generated');
		}
		if (!Array.isArray(result.dimensions) || result.dimensions.length === 0) {
			throw new Error('No dimensions generated');
		}

		result.keywords = result.keywords.map((k) => k.toLowerCase().trim());
		result.dimensions = result.dimensions.map((d, i) => ({
			name: d.name || `dimension_${i}`,
			label: d.label || d.name || `Dimension ${i + 1}`,
			description: d.description || ''
		}));
		result.relevanceDefinition = result.relevanceDefinition || '';
		result.relevanceCriteria = result.relevanceCriteria || { relevant: [], notRelevant: [] };

		return result;
	} catch (e) {
		console.error('Failed to parse project setup response:', text);
		throw new Error('Failed to generate project setup. Please try again.');
	}
}
