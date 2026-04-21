/**
 * Dynamic prompt builder — generates Gemini prompts from project context.
 * Zero hardcoded domain references.
 */

export interface PromptContext {
	projectName: string;
	projectDescription: string;
	relevanceDefinition: string;
	relevanceCriteria: { relevant: string[]; notRelevant: string[] };
	dimensions: { name: string; label: string; description: string }[];
	baseKeywords: string[];
}

export interface PaperInput {
	id: string;
	title: string;
	abstract: string;
	keywords: string[];
	publicationYear?: number;
}

// ─── Relevance Filter Prompt ───────────────────────────────────────

export function buildRelevanceFilterPrompt(ctx: PromptContext, papers: PaperInput[]): string {
	const paperList = papers
		.map(
			(p, i) =>
				`[${i}] ID: ${p.id}\nTitle: ${p.title}\nAbstract: ${p.abstract.slice(0, 500)}\nKeywords: ${p.keywords.join(', ')}`
		)
		.join('\n\n---\n\n');

	const relevantCriteria = ctx.relevanceCriteria.relevant
		.map((c) => `- ${c}`)
		.join('\n');
	const notRelevantCriteria = ctx.relevanceCriteria.notRelevant
		.map((c) => `- ${c}`)
		.join('\n');

	return `You are an expert research analyst for the domain: "${ctx.projectName}".

Context: ${ctx.projectDescription}

Your task is to determine which of the following papers are genuinely relevant to this research domain.

${ctx.relevanceDefinition}

A paper is RELEVANT if it:
${relevantCriteria}

A paper is NOT relevant if it:
${notRelevantCriteria}

For each paper, respond with a JSON array of objects with these fields:
- "id": the paper ID
- "isRelevant": boolean
- "confidence": number between 0 and 1

Papers:

${paperList}

Respond ONLY with a valid JSON array. No other text.`;
}

// ─── Metadata Extraction Prompt ────────────────────────────────────

export function buildMetadataExtractionPrompt(ctx: PromptContext, paper: PaperInput): string {
	return `You are an expert research analyst for the domain: "${ctx.projectName}".

Context: ${ctx.projectDescription}

Analyze this academic paper and extract structured metadata.

Title: ${paper.title}
Abstract: ${paper.abstract || 'No abstract available'}
Keywords: ${paper.keywords.join(', ') || 'None'}
Year: ${paper.publicationYear || 'Unknown'}

Extract and return a JSON object with these fields:
- "summary": A concise 2-line summary of the paper (max 200 characters)
- "methodologySummary": A 2-line description of the methodology used (max 200 characters). If not evident, use "Methodology not specified in abstract"
- "targetPopulation": The specific population or group studied (e.g., affected users, subjects, stakeholders). If general, use "General"
- "focusedRegion": The geographic region or country of focus. If not specified, use "Not specified"
- "platformDomain": The platform, system, or domain context of the study. Use a short label.
- "extractedKeywords": An array of 3-6 specific keywords most relevant to this paper within the domain of "${ctx.projectName}"

Respond ONLY with a valid JSON object. No other text.`;
}

// ─── Analysis Framework Classification Prompt ──────────────────────

export function buildAnalysisClassificationPrompt(
	ctx: PromptContext,
	paper: PaperInput & { summary?: string; methodologySummary?: string }
): string {
	const dimensionInstructions = ctx.dimensions
		.map((d) => `- "${d.name}": ${d.label} — ${d.description || 'Classify accordingly'}`)
		.join('\n');

	const dimensionKeys = ctx.dimensions.map((d) => `"${d.name}"`).join(', ');

	return `You are an expert research analyst classifying a paper in the domain of "${ctx.projectName}".

Context: ${ctx.projectDescription}

Paper details:
Title: ${paper.title}
Abstract: ${paper.abstract || 'No abstract available'}
${paper.summary ? `Summary: ${paper.summary}` : ''}
${paper.methodologySummary ? `Methodology: ${paper.methodologySummary}` : ''}
Year: ${paper.publicationYear || 'Unknown'}

Classify this paper along the following dimensions:
${dimensionInstructions}

Return a JSON object with keys: ${dimensionKeys}
Each value should be a concise classification string. If a dimension doesn't apply, use "Not specified".

Respond ONLY with a valid JSON object. No other text.`;
}

// ─── Keyword Relevance Evaluation Prompt ───────────────────────────

export function buildKeywordRelevancePrompt(
	ctx: PromptContext,
	candidateKeywords: string[]
): string {
	const keywordList = candidateKeywords.map((k, i) => `${i + 1}. "${k}"`).join('\n');

	return `You are an expert research analyst for the domain: "${ctx.projectName}".

Context: ${ctx.projectDescription}

Current base keywords for this domain: ${ctx.baseKeywords.join(', ')}

Evaluate whether each of the following candidate keywords is relevant to this specific research domain. A keyword is relevant if it would help discover papers that are genuinely about this research topic, not just tangentially related.

Candidate keywords:
${keywordList}

For each keyword, respond with a JSON array of objects with these fields:
- "keyword": the keyword string
- "isRelevant": boolean (true if genuinely relevant to the domain)
- "score": number between 0 and 1 (relevance confidence)

Respond ONLY with a valid JSON array. No other text.`;
}

// ─── Search Proposal Prompt ────────────────────────────────────────

export interface StepResults {
	strategyType: string;
	query: string;
	papersFound: number;
	relevantPapers: { title: string; authors: string[]; venue: string; keywords: string[] }[];
	topNewAuthors: { name: string; paperCount: number }[];
	topNewVenues: { name: string; paperCount: number }[];
	topNewKeywords: { term: string; frequency: number }[];
}

export function buildSearchProposalPrompt(ctx: PromptContext, results: StepResults): string {
	const paperSummary = results.relevantPapers
		.slice(0, 10)
		.map(
			(p, i) =>
				`${i + 1}. "${p.title}" — Authors: ${p.authors.join(', ')} — Venue: ${p.venue} — Keywords: ${p.keywords.join(', ')}`
		)
		.join('\n');

	const authorSummary = results.topNewAuthors
		.slice(0, 10)
		.map((a) => `- ${a.name} (${a.paperCount} papers)`)
		.join('\n');

	const venueSummary = results.topNewVenues
		.slice(0, 10)
		.map((v) => `- ${v.name} (${v.paperCount} papers)`)
		.join('\n');

	const keywordSummary = results.topNewKeywords
		.slice(0, 15)
		.map((k) => `- "${k.term}" (found ${k.frequency} times)`)
		.join('\n');

	return `You are a research strategy advisor for the domain: "${ctx.projectName}".

Context: ${ctx.projectDescription}

A search was just completed:
- Strategy: ${results.strategyType} search for "${results.query}"
- Total papers found: ${results.papersFound}
- Relevant papers: ${results.relevantPapers.length}

Top relevant papers found:
${paperSummary}

Prolific new authors discovered:
${authorSummary || 'None notable'}

Top venues (journals/conferences):
${venueSummary || 'None notable'}

Frequently occurring new keywords:
${keywordSummary || 'None notable'}

Based on these results, suggest 2-5 follow-up search strategies to expand the literature coverage. Each strategy should be one of:
- "journal": Search a specific journal/venue (provide the exact venue name)
- "author": Search a specific author (provide the exact author name)
- "topic": Search by keywords (provide 3-5 keyword terms)

For each suggestion, explain WHY this search would be valuable.

Respond with a JSON array of objects:
- "type": "journal" | "author" | "topic"
- "query": the search query (venue name, author name, or comma-separated keywords)
- "reason": why this search is recommended (1-2 sentences)
- "priority": "high" | "medium" | "low"

Respond ONLY with a valid JSON array. No other text.`;
}

// ─── Project Setup Prompt ──────────────────────────────────────────

export function buildProjectSetupPrompt(name: string, description: string): string {
	return `You are an expert research methodology advisor. A researcher is setting up a systematic literature review tool for the following research domain:

Domain name: "${name}"
Description: ${description}

Generate the following to configure this research tool:

1. "keywords": An array of 15-25 specific search keywords that would be effective for discovering relevant papers on OpenAlex. Include both broad and specific terms. Keywords should be lowercase.

2. "dimensions": An array of 5-10 analysis framework dimensions for classifying papers. Each dimension should have:
   - "name": a short snake_case identifier (e.g., "methodology_type", "study_design")
   - "label": a human-readable label (e.g., "Methodology Type", "Study Design")
   - "description": what this dimension captures and example values

3. "relevanceDefinition": A paragraph defining what makes a paper relevant to this specific research domain.

4. "relevanceCriteria": An object with:
   - "relevant": array of 4-6 criteria that make a paper relevant
   - "notRelevant": array of 3-4 criteria that make a paper NOT relevant (exclusion criteria)

Respond ONLY with a valid JSON object containing these 4 fields. No other text.`;
}
