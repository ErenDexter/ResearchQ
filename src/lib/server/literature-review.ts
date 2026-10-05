/**
 * Literature Review Output Generation Service
 *
 * Generates methodology-specific outputs (PRISMA flow, tables, narratives, etc.)
 * using a strategy-per-output-type pattern: some are data-driven (SQL),
 * some are LLM-synthesized, some are hybrid.
 *
 * LLM-synthesized outputs never run on an empty evidence base, and they state
 * which subset of the included studies they were generated from.
 */

import { generateText } from 'ai';
import { z } from 'zod';
import { getModel, generateStructured, MalformedLlmOutputError } from './llm';
import { db } from './db';
import {
	papers,
	searchJobs,
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	journals,
	paperJournals,
	projectDimensions,
	projectReviews,
	reviewOutputs
} from './db/schema';
import { and, asc, count, countDistinct, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { numeric } from './db/helpers';
import { loadPromptContext } from './project-context';
import { loadPaperRelations } from './paper-relations';
import { SCREENING_DECISION_LABELS, screeningDecision, screeningReason, screeningSourceLabel } from '$lib/screening';
import type { TableColumn } from '$lib/review-output';

// ─── Output Type Registry ──────────────────────────────────────────

export const OUTPUT_TYPE_REGISTRY: Record<
	string,
	{ label: string; renderType: string; description: string }
> = {
	prisma_flow_diagram: { label: 'PRISMA Flow Diagram', renderType: 'flow_chart', description: 'Identification → Screening → Eligibility → Included counts' },
	inclusion_exclusion_table: { label: 'Study Selection Table', renderType: 'table', description: 'Paper title, included/excluded, reason' },
	risk_of_bias_table: { label: 'Risk of Bias Assessment', renderType: 'table', description: 'Paper, bias domains, judgments' },
	grade_evidence_table: { label: 'GRADE Evidence Rating', renderType: 'table', description: 'Outcome, studies, certainty, rationale' },
	data_extraction_matrix: { label: 'Data Extraction Matrix', renderType: 'table', description: 'Paper × extraction fields' },
	coding_framework: { label: 'Coding Framework', renderType: 'tree', description: 'Hierarchical codes with paper counts' },
	thematic_synthesis: { label: 'Thematic Synthesis', renderType: 'narrative', description: 'Themes with supporting evidence' },
	conceptual_framework: { label: 'Conceptual Framework', renderType: 'narrative', description: 'Key concepts and relationships' },
	gap_map: { label: 'Research Gap Map', renderType: 'matrix', description: 'Dimensions × coverage, highlighting gaps' },
	forest_plot_data: { label: 'Forest Plot Data', renderType: 'chart_data', description: 'Effect sizes, CIs, weights per study' },
	funnel_plot_data: { label: 'Funnel Plot Data', renderType: 'chart_data', description: 'Effect size vs. precision per study' },
	narrative_summary: { label: 'Narrative Summary', renderType: 'markdown', description: 'LLM-synthesized prose summary' },
	annotated_bibliography: { label: 'Annotated Bibliography', renderType: 'list', description: 'Each paper with structured annotation' },
	protocol_document: { label: 'Protocol Document', renderType: 'markdown', description: 'Full review protocol with sections' },
	quality_appraisal_table: { label: 'Quality Appraisal', renderType: 'table', description: 'Paper × quality criteria scores' },
	bibliometric_analysis: { label: 'Bibliometric Analysis', renderType: 'charts', description: 'Publication trends, author networks' },
	systematic_map_table: { label: 'Systematic Mapping Table', renderType: 'table', description: 'Paper × classification dimensions' },
	search_strategy_log: { label: 'Search Strategy Log', renderType: 'markdown', description: 'Databases searched, queries, dates, results' },
	study_characteristics_table: { label: 'Study Characteristics', renderType: 'table', description: 'Paper, design, setting, population, outcomes' },
	summary_of_findings: { label: 'Summary of Findings', renderType: 'table', description: 'Key outcomes with evidence quality' }
};

/** An error with an HTTP status, so routes can tell user errors from server failures. */
export class OutputGenerationError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'OutputGenerationError';
	}
}

export async function getReviewInProject(projectId: string, reviewId: string) {
	const [review] = await db
		.select()
		.from(projectReviews)
		.where(and(eq(projectReviews.id, reviewId), eq(projectReviews.projectId, projectId)))
		.limit(1);
	return review ?? null;
}

interface TableOutput {
	columns: TableColumn[];
	rows: Record<string, unknown>[];
	note?: string;
}

// ─── Main generation dispatcher ────────────────────────────────────

export async function generateOutput(
	projectId: string,
	reviewId: string,
	outputType: string,
	phaseId?: string
): Promise<{ id: string; contentJson: string | null; contentMarkdown: string | null }> {
	const meta = OUTPUT_TYPE_REGISTRY[outputType];
	if (!meta) throw new OutputGenerationError(`Unknown output type: ${outputType}`, 400);
	if (!(await getReviewInProject(projectId, reviewId))) {
		throw new OutputGenerationError('Review not found in this project', 404);
	}

	let contentJson: unknown = null;
	let contentMarkdown: string | null = null;

	switch (outputType) {
		case 'prisma_flow_diagram':
			contentJson = await generatePrismaFlow(projectId);
			break;
		case 'search_strategy_log':
			contentMarkdown = await generateSearchStrategyLog(projectId);
			break;
		case 'inclusion_exclusion_table':
			contentJson = await generateInclusionExclusionTable(projectId);
			break;
		case 'data_extraction_matrix':
			contentJson = await generateDataExtractionMatrix(projectId);
			break;
		case 'systematic_map_table':
			contentJson = await generateSystematicMapTable(projectId);
			break;
		case 'study_characteristics_table':
			contentJson = await generateStudyCharacteristicsTable(projectId);
			break;
		case 'bibliometric_analysis': {
			const bibResult = await generateBibliometricAnalysis(projectId);
			contentJson = bibResult.json;
			contentMarkdown = bibResult.markdown;
			break;
		}
		case 'narrative_summary':
			contentMarkdown = await generateNarrativeSummary(projectId);
			break;
		case 'thematic_synthesis':
			contentMarkdown = await generateThematicSynthesis(projectId);
			break;
		case 'protocol_document':
			contentMarkdown = await generateProtocolDocument(projectId);
			break;
		case 'annotated_bibliography':
			contentMarkdown = await generateAnnotatedBibliography(projectId);
			break;
		case 'gap_map':
			contentMarkdown = await generateGapMap(projectId);
			break;
		case 'quality_appraisal_table':
			contentJson = await generateQualityAppraisalTable(projectId);
			break;
		case 'risk_of_bias_table':
			contentJson = await generateRiskOfBiasTable(projectId);
			break;
		case 'conceptual_framework':
			contentMarkdown = await generateConceptualFramework(projectId);
			break;
		case 'summary_of_findings':
			contentMarkdown = await generateSummaryOfFindings(projectId);
			break;
		case 'grade_evidence_table':
			contentJson = await generateGradeEvidenceTable(projectId);
			break;
		case 'coding_framework':
			contentJson = await generateCodingFramework(projectId);
			break;
		default:
			contentMarkdown = `Output type "${outputType}" generation is not yet implemented.`;
	}

	// Regenerating replaces the previous version of this output for the same phase.
	await db
		.delete(reviewOutputs)
		.where(
			and(
				eq(reviewOutputs.projectReviewId, reviewId),
				eq(reviewOutputs.outputType, outputType),
				phaseId ? eq(reviewOutputs.phaseId, phaseId) : isNull(reviewOutputs.phaseId)
			)
		);

	const [output] = await db
		.insert(reviewOutputs)
		.values({
			projectReviewId: reviewId,
			phaseId: phaseId || null,
			outputType,
			title: meta.label,
			contentJson: contentJson ? JSON.stringify(contentJson) : null,
			contentMarkdown
		})
		.returning();

	return { id: output.id, contentJson: output.contentJson, contentMarkdown: output.contentMarkdown };
}

// ─── Shared queries ────────────────────────────────────────────────

const includedIn = (projectId: string) => and(eq(papers.projectId, projectId), eq(papers.isRelevant, true));

/** Deterministic order for "which studies does the LLM see": most-cited first. */
const studyOrder = [desc(papers.citedByCount), desc(papers.publicationYear), asc(papers.title)];

async function countIncluded(projectId: string): Promise<number> {
	const [{ n }] = await db.select({ n: count() }).from(papers).where(includedIn(projectId));
	return n;
}

function sampleNote(used: number, total: number): string {
	return used < total
		? `Generated from ${used} of ${total} included studies (the ${used} most-cited). Studies beyond this sample were not considered.`
		: `Generated from all ${total} included studies.`;
}

async function requireIncludedStudies(projectId: string, outputLabel: string): Promise<number> {
	const total = await countIncluded(projectId);
	if (total === 0) {
		throw new OutputGenerationError(
			`No included studies yet — run a search and screen papers before generating the ${outputLabel}.`,
			400
		);
	}
	return total;
}

// ─── Data-driven generators ────────────────────────────────────────

async function generatePrismaFlow(projectId: string) {
	const [{ identified }] = await db
		.select({ identified: numeric(sql`COALESCE(SUM(${searchJobs.totalFound}), 0)`) })
		.from(searchJobs)
		.where(eq(searchJobs.projectId, projectId));

	const bySource = await db
		.select({ isRelevant: papers.isRelevant, source: papers.relevanceSource, n: count() })
		.from(papers)
		.where(eq(papers.projectId, projectId))
		.groupBy(papers.isRelevant, papers.relevanceSource);

	const sum = (pred: (r: (typeof bySource)[number]) => boolean) =>
		bySource.filter(pred).reduce((acc, r) => acc + r.n, 0);

	const stored = sum(() => true);
	const included = sum((r) => r.isRelevant === true);
	const excluded = sum((r) => r.isRelevant === false);
	const notScreened = sum((r) => r.isRelevant === null);
	const keptByDefault = sum((r) => r.isRelevant === true && r.source === 'ai_fallback');
	const keptUnscreened = sum((r) => r.isRelevant === true && r.source === 'auto_include');

	const caveats: string[] = [];
	if (notScreened > 0) caveats.push(`${notScreened} records have not been screened yet and are not counted as excluded.`);
	if (keptByDefault > 0) caveats.push(`${keptByDefault} included records were kept by default because the AI screening output was unusable.`);
	if (keptUnscreened > 0) caveats.push(`${keptUnscreened} included records were kept without AI screening.`);
	caveats.push('Records identified is the sum over all searches, so it counts records found by more than one search once per search.');

	return {
		identification: { records_identified: identified },
		screening: {
			records_after_duplicates_removed: stored,
			records_screened: included + excluded,
			records_excluded: excluded,
			records_awaiting_screening: notScreened
		},
		eligibility: { reports_assessed_for_eligibility: included },
		included: { studies_included: included },
		note: caveats.join(' ')
	};
}

async function generateSearchStrategyLog(projectId: string) {
	const jobs = await db
		.select()
		.from(searchJobs)
		.where(eq(searchJobs.projectId, projectId))
		.orderBy(searchJobs.createdAt);

	// Publisher/database names per job, in one query
	const pubRows = await db
		.selectDistinct({ jobId: papers.searchJobId, publisher: journals.publisher })
		.from(papers)
		.innerJoin(paperJournals, eq(paperJournals.paperId, papers.id))
		.innerJoin(journals, eq(paperJournals.journalId, journals.id))
		.where(and(eq(papers.projectId, projectId), isNotNull(journals.publisher)));
	const publishersByJob = new Map<string, string[]>();
	for (const row of pubRows) {
		if (!row.jobId || !row.publisher) continue;
		publishersByJob.set(row.jobId, [...(publishersByJob.get(row.jobId) ?? []), row.publisher]);
	}

	const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

	let md = '# Search Strategy Log\n\n';
	md += `**Date generated:** ${new Date().toISOString().slice(0, 10)}\n\n`;
	md += '## Searches Conducted\n\n';
	md += '| # | Strategy | Query | Database/Source | Date range | Run on | Status | Records Found | Relevant |\n';
	md += '|---|----------|-------|-----------------|------------|--------|--------|---------------|----------|\n';

	jobs.forEach((job, i) => {
		const pubs = publishersByJob.get(job.id) || [];
		const source = pubs.length > 0 ? `${pubs.join(', ')} via OpenAlex` : 'OpenAlex';
		const range = job.dateFrom || job.dateTo ? `${job.dateFrom || '…'} – ${job.dateTo || '…'}` : 'All dates';
		const query = job.query || (job.type === 'topic' ? '(project keywords)' : '—');
		md += `| ${i + 1} | ${job.type} | ${cell(query)} | ${cell(source)} | ${range} | ${job.createdAt?.slice(0, 10) || '—'} | ${job.status} | ${job.totalFound || 0} | ${job.relevantCount || 0} |\n`;
	});

	const totalFound = jobs.reduce((sum, j) => sum + (j.totalFound || 0), 0);
	const totalRelevant = jobs.reduce((sum, j) => sum + (j.relevantCount || 0), 0);
	md += `\n**Total records identified:** ${totalFound}\n`;
	md += `**Total relevant after screening:** ${totalRelevant}\n`;

	return md;
}

async function generateInclusionExclusionTable(projectId: string): Promise<TableOutput> {
	const allPapers = await db
		.select({
			title: papers.title,
			publicationYear: papers.publicationYear,
			isRelevant: papers.isRelevant,
			relevanceSource: papers.relevanceSource,
			journalName: papers.journalName
		})
		.from(papers)
		.where(eq(papers.projectId, projectId))
		.orderBy(desc(papers.publicationYear), asc(papers.title));

	return {
		columns: [
			{ key: 'title', label: 'Title' },
			{ key: 'year', label: 'Year' },
			{ key: 'venue', label: 'Venue' },
			{ key: 'decision', label: 'Decision' },
			{ key: 'decidedBy', label: 'Decided by' },
			{ key: 'reason', label: 'Reason' }
		],
		rows: allPapers.map((p) => ({
			title: p.title,
			year: p.publicationYear,
			venue: p.journalName,
			decision: SCREENING_DECISION_LABELS[screeningDecision(p.isRelevant)],
			decidedBy: p.isRelevant === null ? null : screeningSourceLabel(p.relevanceSource),
			reason: screeningReason(p.isRelevant, p.relevanceSource)
		}))
	};
}

async function generateDataExtractionMatrix(projectId: string): Promise<TableOutput> {
	const relevant = await db
		.select()
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(desc(papers.publicationYear), asc(papers.title));

	const relations = await loadPaperRelations(relevant.map((p) => p.id), { authors: true });

	return {
		columns: [
			{ key: 'title', label: 'Title' },
			{ key: 'authors', label: 'Authors' },
			{ key: 'year', label: 'Year' },
			{ key: 'venue', label: 'Venue' },
			{ key: 'methodology', label: 'Methodology' },
			{ key: 'population', label: 'Population' },
			{ key: 'region', label: 'Region' },
			{ key: 'platform', label: 'Platform' },
			{ key: 'summary', label: 'Summary' }
		],
		rows: relevant.map((p) => ({
			title: p.title,
			authors: (relations.authors.get(p.id) ?? []).map((a) => a.name).join('; '),
			year: p.publicationYear,
			venue: p.journalName,
			methodology: p.methodologySummary,
			population: p.targetPopulation,
			region: p.focusedRegion,
			platform: p.platformDomain,
			summary: p.summary
		}))
	};
}

async function generateSystematicMapTable(projectId: string): Promise<TableOutput> {
	const relevant = await db
		.select({ id: papers.id, title: papers.title, publicationYear: papers.publicationYear })
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(desc(papers.publicationYear), asc(papers.title));

	const dimensions = await db
		.select({ name: projectDimensions.name, label: projectDimensions.label })
		.from(projectDimensions)
		.where(eq(projectDimensions.projectId, projectId))
		.orderBy(projectDimensions.position);

	const relations = await loadPaperRelations(relevant.map((p) => p.id), { tags: true });

	// Project dimensions first (in their configured order), then any tags from removed dimensions.
	const columns: TableColumn[] = dimensions.map((d) => ({ key: `tag:${d.name}`, label: d.label }));
	const known = new Set(dimensions.map((d) => d.name));
	for (const tags of relations.tags.values()) {
		for (const name of Object.keys(tags)) {
			if (!known.has(name)) {
				known.add(name);
				columns.push({ key: `tag:${name}`, label: name });
			}
		}
	}

	return {
		columns: [{ key: 'title', label: 'Title' }, { key: 'year', label: 'Year' }, ...columns],
		rows: relevant.map((p) => {
			const row: Record<string, unknown> = { title: p.title, year: p.publicationYear };
			for (const [name, value] of Object.entries(relations.tags.get(p.id) ?? {})) row[`tag:${name}`] = value;
			return row;
		})
	};
}

async function generateStudyCharacteristicsTable(projectId: string): Promise<TableOutput> {
	const relevant = await db
		.select()
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(desc(papers.publicationYear), asc(papers.title));

	return {
		columns: [
			{ key: 'title', label: 'Title' },
			{ key: 'year', label: 'Year' },
			{ key: 'methodology', label: 'Methodology' },
			{ key: 'population', label: 'Population' },
			{ key: 'region', label: 'Region' },
			{ key: 'platform', label: 'Platform/Domain' }
		],
		rows: relevant.map((p) => ({
			title: p.title,
			year: p.publicationYear,
			methodology: p.methodologySummary,
			population: p.targetPopulation,
			region: p.focusedRegion,
			platform: p.platformDomain
		}))
	};
}

async function generateBibliometricAnalysis(projectId: string) {
	const byYear = await db
		.select({ year: papers.publicationYear, count: count() })
		.from(papers)
		.where(includedIn(projectId))
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	const byVenue = await db
		.select({ venue: papers.journalName, count: count() })
		.from(papers)
		.where(includedIn(projectId))
		.groupBy(papers.journalName)
		.orderBy(desc(count()))
		.limit(15);

	const topAuthors = await db
		.select({ name: authors.name, count: countDistinct(papers.id) })
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
		.where(includedIn(projectId))
		.groupBy(authors.id)
		.orderBy(desc(countDistinct(papers.id)))
		.limit(15);

	const topKeywords = await db
		.select({ term: keywords.term, count: count() })
		.from(paperKeywords)
		.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
		.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
		.where(includedIn(projectId))
		.groupBy(keywords.term)
		.orderBy(desc(count()))
		.limit(20);

	const data = { byYear, byVenue, topAuthors, topKeywords };
	const cell = (s: string) => s.replace(/\|/g, '\\|');

	// Generate markdown tables for human-readable rendering
	let md = '# Bibliometric Analysis\n\n';

	md += '## Publication Trends by Year\n\n';
	md += '| Year | Papers |\n|------|--------|\n';
	for (const row of byYear) md += `| ${row.year || '—'} | ${row.count} |\n`;

	md += '\n## Top Venues\n\n';
	md += '| Venue | Papers |\n|-------|--------|\n';
	for (const row of byVenue) md += `| ${cell(row.venue || '(unknown)')} | ${row.count} |\n`;

	md += '\n## Top Authors\n\n';
	md += '| Author | Papers |\n|--------|--------|\n';
	for (const row of topAuthors) md += `| ${cell(row.name)} | ${row.count} |\n`;

	md += '\n## Top Keywords\n\n';
	md += '| Keyword | Occurrences |\n|---------|-------------|\n';
	for (const row of topKeywords) md += `| ${cell(row.term)} | ${row.count} |\n`;

	return { json: data, markdown: md };
}

// ─── LLM-synthesized generators ────────────────────────────────────

interface StudySample {
	text: string;
	used: number;
	total: number;
	note: string;
}

/** The most-cited included studies (up to `limit`), formatted as a numbered list for prompts. */
async function getStudySample(projectId: string, outputLabel: string, limit = 50): Promise<StudySample> {
	const total = await requireIncludedStudies(projectId, outputLabel);
	const relevant = await db
		.select({ title: papers.title, summary: papers.summary, abstract: papers.abstract, publicationYear: papers.publicationYear })
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(...studyOrder)
		.limit(limit);

	return {
		text: relevant
			.map((p, i) => `[${i + 1}] "${p.title}" (${p.publicationYear || '?'})\n${p.summary || p.abstract?.slice(0, 300) || 'No summary'}`)
			.join('\n\n'),
		used: relevant.length,
		total,
		note: sampleNote(relevant.length, total)
	};
}

async function llmGenerate(prompt: string): Promise<string> {
	const { text } = await generateText({ model: getModel(), prompt });
	return text.trim();
}

/** Prepends the sample disclosure to an LLM-written markdown output. */
function withNote(note: string, markdown: string): string {
	return `> ${note}\n\n${markdown}`;
}

/** Structured LLM call for review outputs: malformed output becomes a user-facing error. */
async function generateReviewData<T>(schema: z.ZodType<T>, prompt: string, outputLabel: string): Promise<T> {
	try {
		return await generateStructured(schema, prompt);
	} catch (err) {
		if (err instanceof MalformedLlmOutputError) {
			throw new OutputGenerationError(`The model returned an unusable ${outputLabel}. Please try again.`, 502);
		}
		throw err;
	}
}

async function generateNarrativeSummary(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const sample = await getStudySample(projectId, 'narrative summary');

	return withNote(sample.note, await llmGenerate(`You are writing the narrative synthesis section of a systematic literature review on "${ctx.projectName}".

Context: ${ctx.projectDescription}

Below are summaries of ${sample.used} included studies:

${sample.text}

Write a comprehensive narrative synthesis (800-1200 words) that:
1. Organizes findings by major themes
2. Identifies areas of agreement and disagreement across studies
3. Highlights methodological trends
4. Notes geographic and temporal patterns
5. Identifies limitations in the current evidence base

Base every statement on the studies above and cite them by number, e.g. [3]. Write in academic prose suitable for publication. Use markdown formatting.`));
}

async function generateThematicSynthesis(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const sample = await getStudySample(projectId, 'thematic synthesis');

	return withNote(sample.note, await llmGenerate(`You are conducting a thematic synthesis of research on "${ctx.projectName}".

${sample.text}

Perform a three-stage thematic synthesis:
1. **Line-by-line coding**: Identify key concepts from each study
2. **Descriptive themes**: Group codes into descriptive themes
3. **Analytical themes**: Develop higher-order analytical themes that go beyond the primary studies

Present as a structured markdown document with:
- A list of identified themes (with brief descriptions)
- For each theme: which studies support it (reference by number)
- A final section on cross-cutting patterns and relationships between themes`));
}

async function generateProtocolDocument(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);

	return llmGenerate(`Generate a systematic review protocol document for a study on "${ctx.projectName}".

Research domain: ${ctx.projectDescription}

Relevance criteria: ${ctx.relevanceDefinition}

Generate a complete protocol document in markdown with these sections:
1. **Title**
2. **Background** — why this review is needed
3. **Research Questions** — 2-4 specific questions
4. **Search Strategy** — databases to search, search terms, Boolean operators
5. **Eligibility Criteria** — inclusion and exclusion criteria
6. **Study Selection Process** — screening stages
7. **Quality Assessment** — tools/criteria to use
8. **Data Extraction** — what data to extract and how
9. **Data Synthesis** — planned approach (narrative, meta-analysis, etc.)
10. **Timeline**
11. **Team Roles** (generic)

Write in formal academic style suitable for protocol registration.`);
}

async function generateAnnotatedBibliography(projectId: string): Promise<string> {
	const total = await requireIncludedStudies(projectId, 'annotated bibliography');
	const relevant = await db
		.select({
			id: papers.id,
			title: papers.title,
			doi: papers.doi,
			publicationYear: papers.publicationYear,
			journalName: papers.journalName,
			summary: papers.summary,
			abstract: papers.abstract
		})
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(...studyOrder)
		.limit(50);

	const relations = await loadPaperRelations(relevant.map((p) => p.id), { authors: true });

	// Pass the real bibliographic data so the model formats citations instead of inventing them.
	const entries = relevant
		.map((p, i) => {
			const authorNames = (relations.authors.get(p.id) ?? []).map((a) => a.name).join(', ') || 'Unknown authors';
			return `[${i + 1}] Authors: ${authorNames}\nTitle: "${p.title}"\nYear: ${p.publicationYear || 'n.d.'}\nVenue: ${p.journalName || 'Unknown venue'}${p.doi ? `\nDOI: ${p.doi}` : ''}\nContent: ${p.summary || p.abstract?.slice(0, 400) || 'No summary'}`;
		})
		.join('\n\n');

	return withNote(sampleNote(relevant.length, total), await llmGenerate(`Generate an annotated bibliography for these ${relevant.length} papers. For each entry, write:
1. A citation line built ONLY from the authors, title, year, venue and DOI given — do not add or guess any details
2. A 2-3 sentence annotation: what the study does, its methodology, and its key findings

Papers:
${entries}

Format as a numbered markdown list. Each entry should have the citation in bold followed by the annotation paragraph.`));
}

async function generateGapMap(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const sample = await getStudySample(projectId, 'research gap map', 30);

	return withNote(sample.note, await llmGenerate(`You are creating a research gap map for a systematic review on "${ctx.projectName}".

${sample.text}

Create a structured research gap map in markdown that identifies:
1. **Well-covered areas** — topics with strong evidence (many studies)
2. **Under-researched areas** — topics with few or no studies
3. **Methodological gaps** — missing research approaches
4. **Geographic gaps** — under-represented regions
5. **Temporal gaps** — time periods with insufficient coverage
6. **Population gaps** — under-studied groups

Present as a structured markdown document with clear headings and bullet points. For each gap, suggest a potential research question to address it.`));
}

/** Loads the sample for per-study LLM tables (quality, risk of bias). */
async function getAppraisalSample(projectId: string, outputLabel: string, limit = 30) {
	const total = await requireIncludedStudies(projectId, outputLabel);
	const relevant = await db
		.select({ id: papers.id, title: papers.title, methodologySummary: papers.methodologySummary })
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(...studyOrder)
		.limit(limit);
	const list = relevant
		.map((p, i) => `[${i + 1}] "${p.title}"\nMethodology: ${p.methodologySummary || 'Not specified'}`)
		.join('\n\n');
	return { relevant, list, note: sampleNote(relevant.length, total) };
}

/**
 * Matches per-study assessments back to papers by the 1-based index the model
 * was given (never by array position, which shifts if the model skips or
 * reorders a study). Studies without an assessment get an empty row.
 */
export function rowsByStudyIndex<A extends { index: number }>(
	studies: { title: string }[],
	assessments: A[],
	toRow: (assessment: A) => Record<string, unknown>,
	missingRow: Record<string, unknown>
): Record<string, unknown>[] {
	const byIndex = new Map<number, A>();
	for (const a of assessments) {
		if (a.index >= 1 && a.index <= studies.length && !byIndex.has(a.index)) byIndex.set(a.index, a);
	}
	return studies.map((study, i) => {
		const assessment = byIndex.get(i + 1);
		return { title: study.title, ...(assessment ? toRow(assessment) : missingRow) };
	});
}

const QUALITY_CRITERIA = [
	{ key: 'objectives', label: 'Objectives', description: 'Clear research objectives' },
	{ key: 'methodology', label: 'Methodology', description: 'Appropriate methodology' },
	{ key: 'sample', label: 'Sample', description: 'Adequate sample/data' },
	{ key: 'analysis', label: 'Analysis', description: 'Valid analysis' },
	{ key: 'reporting', label: 'Reporting', description: 'Clear reporting of results' }
] as const;

const qualitySchema = z.object({
	assessments: z.array(
		z.object({
			index: z.number().int(),
			objectives: z.number().int(),
			methodology: z.number().int(),
			sample: z.number().int(),
			analysis: z.number().int(),
			reporting: z.number().int(),
			quality: z.enum(['high', 'medium', 'low'])
		})
	)
});

async function generateQualityAppraisalTable(projectId: string): Promise<TableOutput> {
	const ctx = await loadPromptContext(projectId);
	const { relevant, list, note } = await getAppraisalSample(projectId, 'quality appraisal');

	const { assessments } = await generateReviewData(
		qualitySchema,
		`You are appraising the quality of studies in a review on "${ctx.projectName}".

${list}

For each study, assess quality on these criteria (score 0-2: 0=not met, 1=partially met, 2=fully met):
${QUALITY_CRITERIA.map((c, i) => `${i + 1}. "${c.key}": ${c.description}`).join('\n')}

Respond with a JSON object {"assessments": [...]} with one entry per study containing: "index" (the study's number in brackets), the five criteria keys above with their scores, and "quality" ("high"/"medium"/"low").`,
		'quality appraisal'
	);

	const clampScore = (n: number) => Math.min(2, Math.max(0, n));

	return {
		columns: [
			{ key: 'title', label: 'Title' },
			...QUALITY_CRITERIA.map(({ key, label }) => ({ key, label })),
			{ key: 'totalScore', label: 'Total (0-10)' },
			{ key: 'quality', label: 'Quality' }
		],
		rows: rowsByStudyIndex(
			relevant,
			assessments,
			(a) => {
				const scores = Object.fromEntries(QUALITY_CRITERIA.map(({ key }) => [key, clampScore(a[key])]));
				const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
				return { ...scores, totalScore, quality: a.quality };
			},
			{ quality: 'Not assessed' }
		),
		note
	};
}

const BIAS_DOMAINS = [
	{ key: 'selection', label: 'Selection' },
	{ key: 'performance', label: 'Performance' },
	{ key: 'detection', label: 'Detection' },
	{ key: 'attrition', label: 'Attrition' },
	{ key: 'reporting', label: 'Reporting' }
] as const;

const judgment = z.enum(['low', 'high', 'unclear']);

const riskOfBiasSchema = z.object({
	assessments: z.array(
		z.object({
			index: z.number().int(),
			selection: judgment,
			performance: judgment,
			detection: judgment,
			attrition: judgment,
			reporting: judgment,
			overall: judgment
		})
	)
});

async function generateRiskOfBiasTable(projectId: string): Promise<TableOutput> {
	const ctx = await loadPromptContext(projectId);
	const { relevant, list, note } = await getAppraisalSample(projectId, 'risk of bias assessment');

	const { assessments } = await generateReviewData(
		riskOfBiasSchema,
		`Assess risk of bias for these studies in a review on "${ctx.projectName}".

${list}

For each study, rate bias risk as "low", "high", or "unclear" in these domains: ${BIAS_DOMAINS.map((d) => `"${d.key}"`).join(', ')}, plus an "overall" judgment.

Respond with a JSON object {"assessments": [...]} with one entry per study containing: "index" (the study's number in brackets), the five domain keys, and "overall".`,
		'risk of bias assessment'
	);

	return {
		columns: [
			{ key: 'title', label: 'Title' },
			...BIAS_DOMAINS.map(({ key, label }) => ({ key, label })),
			{ key: 'overall', label: 'Overall' }
		],
		rows: rowsByStudyIndex(
			relevant,
			assessments,
			(a) => ({
				...Object.fromEntries(BIAS_DOMAINS.map(({ key }) => [key, a[key]])),
				overall: a.overall
			}),
			{ overall: 'Not assessed' }
		),
		note
	};
}

async function generateConceptualFramework(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const sample = await getStudySample(projectId, 'conceptual framework', 30);

	return withNote(sample.note, await llmGenerate(`Based on these studies in "${ctx.projectName}", develop a conceptual framework.

${sample.text}

Create a markdown document that:
1. Identifies the **key concepts** that emerge from the literature
2. Describes the **relationships** between these concepts
3. Proposes a **visual framework** (described textually as boxes and arrows)
4. Explains how this framework synthesizes the existing evidence
5. Identifies where the framework has gaps or weak connections

Write in academic prose. Use markdown headings and bullet points for clarity.`));
}

async function generateSummaryOfFindings(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const sample = await getStudySample(projectId, 'summary of findings', 40);

	return withNote(sample.note, await llmGenerate(`Create a Summary of Findings for a systematic review on "${ctx.projectName}".

${sample.text}

Generate a structured Summary of Findings in markdown that includes:
1. **Key findings** — 5-8 major findings organized by theme
2. **Strength of evidence** — how well-supported each finding is (number of studies, consistency)
3. **Practical implications** — what these findings mean for practitioners
4. **Research implications** — what questions remain unanswered
5. **Limitations** — caveats and limitations of the reviewed evidence

Cite supporting studies by number, e.g. [3]. Write in clear, concise academic prose.`));
}

const gradeSchema = z.object({
	outcomes: z.array(
		z.object({
			outcome: z.string(),
			studies: z.number().int(),
			certainty: z.enum(['High', 'Moderate', 'Low', 'Very Low']),
			rationale: z.string()
		})
	)
});

async function generateGradeEvidenceTable(projectId: string): Promise<TableOutput> {
	const ctx = await loadPromptContext(projectId);
	const sample = await getStudySample(projectId, 'GRADE evidence table', 30);

	const { outcomes } = await generateReviewData(
		gradeSchema,
		`Apply the GRADE framework to rate evidence certainty for a review on "${ctx.projectName}".

${sample.text}

Identify 3-6 key outcomes/findings from these studies. For each outcome, rate the certainty of evidence using GRADE:
- Start at "High" for RCTs, "Low" for observational
- Downgrade for: risk of bias, inconsistency, indirectness, imprecision, publication bias
- Upgrade for: large effect, dose-response, confounders would reduce effect

Respond with a JSON object {"outcomes": [...]} where each entry has: "outcome", "studies" (number of the studies above that report it), "certainty" ("High"/"Moderate"/"Low"/"Very Low"), "rationale".`,
		'GRADE evidence table'
	);

	return {
		columns: [
			{ key: 'outcome', label: 'Outcome' },
			{ key: 'studies', label: 'Studies' },
			{ key: 'certainty', label: 'Certainty' },
			{ key: 'rationale', label: 'Rationale' }
		],
		rows: outcomes,
		note: sample.note
	};
}

const codingFrameworkSchema = z.object({
	categories: z.array(
		z.object({
			name: z.string(),
			description: z.string(),
			codes: z.array(
				z.object({
					name: z.string(),
					description: z.string(),
					studyIndices: z.array(z.number().int())
				})
			)
		})
	)
});

async function generateCodingFramework(projectId: string) {
	const ctx = await loadPromptContext(projectId);
	const total = await requireIncludedStudies(projectId, 'coding framework');
	const studies = await db
		.select({ title: papers.title, summary: papers.summary, abstract: papers.abstract, publicationYear: papers.publicationYear })
		.from(papers)
		.where(includedIn(projectId))
		.orderBy(...studyOrder)
		.limit(30);
	const list = studies
		.map((p, i) => `[${i + 1}] "${p.title}" (${p.publicationYear || '?'})\n${p.summary || p.abstract?.slice(0, 300) || 'No summary'}`)
		.join('\n\n');

	const { categories } = await generateReviewData(
		codingFrameworkSchema,
		`Develop a coding framework/taxonomy for a review on "${ctx.projectName}".

${list}

Create a hierarchical coding framework by:
1. Identifying top-level categories (4-8)
2. Breaking each into sub-codes (2-5 per category)
3. For each code, listing which studies (by their number in brackets) it applies to

Respond with a JSON object: { "categories": [{ "name", "description", "codes": [{ "name", "description", "studyIndices": [1, 3, 5] }] }] }`,
		'coding framework'
	);

	// Store study titles rather than prompt-local numbers, which mean nothing to readers.
	const titleOf = (n: number) => studies[n - 1]?.title;
	return {
		categories: categories.map((c) => ({
			name: c.name,
			description: c.description,
			codes: c.codes.map((code) => ({
				name: code.name,
				description: code.description,
				studies: [...new Set(code.studyIndices)].map(titleOf).filter(Boolean)
			}))
		})),
		note: sampleNote(studies.length, total)
	};
}
