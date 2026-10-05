/**
 * Google Gemini Agent Service (via Vercel AI Gateway)
 *
 * Provides AI-powered capabilities:
 * 1. Relevance filtering — bulk-classify papers as relevant to the project domain
 * 2. Metadata extraction — extract structured fields from paper titles/abstracts
 * 3. Analysis framework classification — map papers to project-specific dimensions
 * 4. Keyword relevance evaluation — score candidate keywords for the project domain
 *
 * All calls use schema-validated structured output. Malformed model output is
 * handled per function (documented below); API/network errors propagate so the
 * job fails and can be retried from its last checkpoint.
 */

import { z } from 'zod';
import { generateStructured, MalformedLlmOutputError } from './llm';
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

/**
 * Who made a paper's screening decision:
 * - ai           — the model screened it
 * - ai_fallback  — the model's answer was unusable/missing, so the paper was kept by default
 * - auto_include — AI screening was skipped for the search, so the paper was kept
 * - manual       — set by a person
 */
export type RelevanceSource = 'ai' | 'ai_fallback' | 'auto_include' | 'manual';

export interface RelevanceResult {
	id: string;
	isRelevant: boolean;
	confidence: number;
	source: Extract<RelevanceSource, 'ai' | 'ai_fallback'>;
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

function clamp01(n: number): number {
	return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

// ─── Relevance Filtering (batch) ───────────────────────────────────

const relevanceSchema = z.object({
	results: z.array(
		z.object({
			index: z.number().int(),
			isRelevant: z.boolean(),
			confidence: z.number()
		})
	)
});

/**
 * Screens a batch of papers. Returns exactly one result per input paper.
 * Papers the model skipped (or every paper, if its output was unusable) are
 * kept by default and marked `ai_fallback` so the decision stays auditable.
 */
export async function filterRelevance(
	papers: PaperInput[],
	ctx: PromptContext
): Promise<RelevanceResult[]> {
	const decisions = new Map<number, { isRelevant: boolean; confidence: number }>();

	try {
		const { results } = await generateStructured(
			relevanceSchema,
			buildRelevanceFilterPrompt(ctx, papers)
		);
		for (const r of results) {
			if (r.index >= 0 && r.index < papers.length && !decisions.has(r.index)) {
				decisions.set(r.index, { isRelevant: r.isRelevant, confidence: clamp01(r.confidence) });
			}
		}
	} catch (err) {
		if (!(err instanceof MalformedLlmOutputError)) throw err;
		console.error('Relevance screening output unusable; keeping batch by default.');
	}

	return papers.map((p, i) => {
		const decision = decisions.get(i);
		return decision
			? { id: p.id, ...decision, source: 'ai' as const }
			: { id: p.id, isRelevant: true, confidence: 0, source: 'ai_fallback' as const };
	});
}

// ─── Metadata Extraction (per paper) ───────────────────────────────

const metadataSchema = z.object({
	summary: z.string(),
	methodologySummary: z.string(),
	targetPopulation: z.string(),
	focusedRegion: z.string(),
	platformDomain: z.string(),
	extractedKeywords: z.array(z.string())
});

export async function extractMetadata(
	paper: PaperInput,
	ctx: PromptContext
): Promise<ExtractedMetadata> {
	try {
		const parsed = await generateStructured(
			metadataSchema,
			buildMetadataExtractionPrompt(ctx, paper)
		);
		return {
			summary: parsed.summary,
			methodologySummary: parsed.methodologySummary,
			targetPopulation: parsed.targetPopulation || 'Not specified',
			focusedRegion: parsed.focusedRegion || 'Not specified',
			platformDomain: parsed.platformDomain || 'General',
			extractedKeywords: parsed.extractedKeywords.map((k) => k.trim()).filter(Boolean)
		};
	} catch (err) {
		if (!(err instanceof MalformedLlmOutputError)) throw err;
		// Record the failure on the paper rather than retrying forever.
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
	if (ctx.dimensions.length === 0) return {};

	const schema = z.object(
		Object.fromEntries(ctx.dimensions.map((dim) => [dim.name, z.string()]))
	) as z.ZodType<Record<string, string>>;

	try {
		const parsed = await generateStructured(schema, buildAnalysisClassificationPrompt(ctx, paper));
		const tags: AnalysisFrameworkTags = {};
		for (const dim of ctx.dimensions) {
			tags[dim.name] = parsed[dim.name]?.trim() || '';
		}
		return tags;
	} catch (err) {
		if (!(err instanceof MalformedLlmOutputError)) throw err;
		return Object.fromEntries(ctx.dimensions.map((dim) => [dim.name, '']));
	}
}

// ─── Keyword Relevance Evaluation ──────────────────────────────────

const keywordRelevanceSchema = z.object({
	results: z.array(
		z.object({
			keyword: z.string(),
			isRelevant: z.boolean(),
			score: z.number()
		})
	)
});

/** Returns an empty list (nothing accepted) if the model's output is unusable. */
export async function evaluateKeywordRelevance(
	candidateKeywords: string[],
	ctx: PromptContext
): Promise<KeywordRelevanceResult[]> {
	if (candidateKeywords.length === 0) return [];

	try {
		const { results } = await generateStructured(
			keywordRelevanceSchema,
			buildKeywordRelevancePrompt(ctx, candidateKeywords)
		);
		// Only accept keywords we asked about (the model may echo them with different casing).
		const normalize = (k: string) => k.toLowerCase().trim();
		const candidates = new Set(candidateKeywords.map(normalize));
		return results
			.map((r) => ({ ...r, keyword: normalize(r.keyword), score: clamp01(r.score) }))
			.filter((r) => candidates.has(r.keyword));
	} catch (err) {
		if (!(err instanceof MalformedLlmOutputError)) throw err;
		console.error('Keyword relevance output unusable; no keywords accepted.');
		return [];
	}
}
