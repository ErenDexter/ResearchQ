/**
 * Google Gemini Agent Service (via Vercel AI Gateway)
 *
 * Provides AI-powered capabilities:
 * 1. Relevance filtering — bulk-classify papers as relevant to the project domain
 * 2. Metadata extraction — extract structured fields from paper titles/abstracts
 * 3. Analysis framework classification — map papers to project-specific dimensions
 * 4. Keyword relevance evaluation — score candidate keywords for the project domain
 */

import { generateText } from 'ai';
import { getModel } from './llm';
import {
	type PromptContext,
	type PaperInput,
	buildRelevanceFilterPrompt,
	buildMetadataExtractionPrompt,
	buildAnalysisClassificationPrompt,
	buildKeywordRelevancePrompt
} from './prompts';

// ─── Types ──────────────────────────────────────────────────────────

export type { PaperInput } from './prompts';

export interface RelevanceResult {
	id: string;
	isRelevant: boolean;
	confidence: number;
}

export interface ExtractedMetadata {
	summary: string;
	methodologySummary: string;
	targetPopulation: string;
	focusedRegion: string;
	platformDomain: string;
	extractedKeywords: string[];
}

// Dynamic: keys depend on project dimensions
export type AnalysisFrameworkTags = Record<string, string>;

export interface KeywordRelevanceResult {
	keyword: string;
	isRelevant: boolean;
	score: number;
}

function cleanJsonResponse(text: string): string {
	return text.trim().replace(/^```json?\s*/, '').replace(/```\s*$/, '');
}

// ─── Relevance Filtering (batch) ───────────────────────────────────

export async function filterRelevance(
	papers: PaperInput[],
	ctx: PromptContext
): Promise<RelevanceResult[]> {
	const prompt = buildRelevanceFilterPrompt(ctx, papers);

	const { text } = await generateText({
		model: getModel(),
		prompt
	});

	const cleaned = cleanJsonResponse(text);

	try {
		return JSON.parse(cleaned) as RelevanceResult[];
	} catch {
		console.error('Failed to parse Gemini relevance response:', text);
		// Fallback: mark all as relevant to avoid data loss
		return papers.map((p) => ({ id: p.id, isRelevant: true, confidence: 0.5 }));
	}
}

// ─── Metadata Extraction (per paper) ───────────────────────────────

export async function extractMetadata(
	paper: PaperInput,
	ctx: PromptContext
): Promise<ExtractedMetadata> {
	const prompt = buildMetadataExtractionPrompt(ctx, paper);

	const { text } = await generateText({
		model: getModel(),
		prompt
	});

	const cleaned = cleanJsonResponse(text);

	try {
		const parsed = JSON.parse(cleaned);
		return {
			summary: parsed.summary || '',
			methodologySummary: parsed.methodologySummary || '',
			targetPopulation: parsed.targetPopulation || 'Not specified',
			focusedRegion: parsed.focusedRegion || 'Not specified',
			platformDomain: parsed.platformDomain || 'General',
			extractedKeywords: parsed.extractedKeywords || []
		};
	} catch {
		console.error('Failed to parse Gemini extraction response:', text);
		return {
			summary: '',
			methodologySummary: '',
			targetPopulation: 'Extraction failed',
			focusedRegion: 'Extraction failed',
			platformDomain: 'Extraction failed',
			extractedKeywords: []
		};
	}
}

// ─── Analysis Framework Classification (dynamic dimensions) ────────

export async function classifyAnalysisFramework(
	paper: PaperInput & { summary?: string; methodologySummary?: string },
	ctx: PromptContext
): Promise<AnalysisFrameworkTags> {
	const prompt = buildAnalysisClassificationPrompt(ctx, paper);

	const { text } = await generateText({
		model: getModel(),
		prompt
	});

	const cleaned = cleanJsonResponse(text);

	try {
		const parsed = JSON.parse(cleaned);
		// Return only the dimensions defined in the project
		const tags: AnalysisFrameworkTags = {};
		for (const dim of ctx.dimensions) {
			tags[dim.name] = parsed[dim.name] || '';
		}
		return tags;
	} catch {
		console.error('Failed to parse Gemini analysis response:', text);
		const tags: AnalysisFrameworkTags = {};
		for (const dim of ctx.dimensions) {
			tags[dim.name] = '';
		}
		return tags;
	}
}

// ─── Keyword Relevance Evaluation ──────────────────────────────────

export async function evaluateKeywordRelevance(
	candidateKeywords: string[],
	ctx: PromptContext
): Promise<KeywordRelevanceResult[]> {
	if (candidateKeywords.length === 0) return [];

	const prompt = buildKeywordRelevancePrompt(ctx, candidateKeywords);

	const { text } = await generateText({
		model: getModel(),
		prompt
	});

	const cleaned = cleanJsonResponse(text);

	try {
		return JSON.parse(cleaned) as KeywordRelevanceResult[];
	} catch {
		console.error('Failed to parse Gemini keyword relevance response:', text);
		// Fallback: mark all as relevant with low confidence
		return candidateKeywords.map((k) => ({ keyword: k, isRelevant: true, score: 0.5 }));
	}
}
