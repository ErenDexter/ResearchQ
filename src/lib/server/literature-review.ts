/**
 * Literature Review Output Generation Service
 *
 * Generates methodology-specific outputs (PRISMA flow, tables, narratives, etc.)
 * using a strategy-per-output-type pattern: some are data-driven (SQL),
 * some are LLM-synthesized, some are hybrid.
 */

import { generateText } from 'ai';
import { getModel } from './llm';
import { db } from './db';
import {
	papers,
	searchJobs,
	paperAuthors,
	authors,
	paperKeywords,
	keywords,
	analysisTags,
	journals,
	paperJournals,
	reviewOutputs
} from './db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { loadPromptContext } from './project-context';

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

// ─── Main generation dispatcher ────────────────────────────────────

export async function generateOutput(
	projectId: string,
	reviewId: string,
	outputType: string,
	phaseId?: string
): Promise<{ id: string; contentJson: string | null; contentMarkdown: string | null }> {
	const meta = OUTPUT_TYPE_REGISTRY[outputType];
	if (!meta) throw new Error(`Unknown output type: ${outputType}`);

	let contentJson: any = null;
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

	// Persist
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

// ─── Data-driven generators ────────────────────────────────────────

async function generatePrismaFlow(projectId: string) {
	const totalFound = (
		await db
			.select({ total: sql<number>`SUM(total_found)` })
			.from(searchJobs)
			.where(eq(searchJobs.projectId, projectId))
	)[0]?.total || 0;

	const totalStored = (
		await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(papers)
			.where(eq(papers.projectId, projectId))
	)[0]?.count || 0;

	const afterScreening = (
		await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(papers)
			.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
	)[0]?.count || 0;

	const excluded = totalStored - afterScreening;

	return {
		identification: { records_from_databases: totalFound },
		screening: { records_after_dedup: totalStored, records_excluded: excluded },
		eligibility: { full_text_assessed: afterScreening },
		included: { studies_included: afterScreening }
	};
}

async function generateSearchStrategyLog(projectId: string) {
	const jobs = await db
		.select()
		.from(searchJobs)
		.where(eq(searchJobs.projectId, projectId))
		.orderBy(searchJobs.createdAt);

	// Build a map of job ID → publisher/database names
	const publishersByJob = new Map<string, string[]>();
	for (const job of jobs) {
		const pubs = await db
			.selectDistinct({ publisher: journals.publisher })
			.from(papers)
			.innerJoin(paperJournals, eq(paperJournals.paperId, papers.id))
			.innerJoin(journals, eq(paperJournals.journalId, journals.id))
			.where(and(eq(papers.searchJobId, job.id), sql`${journals.publisher} IS NOT NULL`));
		publishersByJob.set(job.id, pubs.map((p) => p.publisher!).filter(Boolean));
	}

	let md = '# Search Strategy Log\n\n';
	md += `**Date generated:** ${new Date().toISOString().slice(0, 10)}\n\n`;
	md += '## Searches Conducted\n\n';
	md += '| # | Strategy | Query | Database/Source | Date | Records Found | Relevant |\n';
	md += '|---|----------|-------|-----------------|------|---------------|----------|\n';

	jobs.forEach((job, i) => {
		const pubs = publishersByJob.get(job.id) || [];
		const source = pubs.length > 0
			? `${pubs.join(', ')} via OpenAlex`
			: 'OpenAlex';
		md += `| ${i + 1} | ${job.type} | ${job.query} | ${source} | ${job.createdAt?.slice(0, 10) || '—'} | ${job.totalFound || 0} | ${job.relevantCount || 0} |\n`;
	});

	const totalFound = jobs.reduce((sum, j) => sum + (j.totalFound || 0), 0);
	const totalRelevant = jobs.reduce((sum, j) => sum + (j.relevantCount || 0), 0);
	md += `\n**Total records identified:** ${totalFound}\n`;
	md += `**Total relevant after screening:** ${totalRelevant}\n`;

	return md;
}

async function generateInclusionExclusionTable(projectId: string) {
	const allPapers = await db
		.select({
			id: papers.id,
			title: papers.title,
			publicationYear: papers.publicationYear,
			isRelevant: papers.isRelevant,
			journalName: papers.journalName
		})
		.from(papers)
		.where(eq(papers.projectId, projectId))
		.orderBy(desc(papers.publicationYear));

	return {
		columns: ['Title', 'Year', 'Venue', 'Decision', 'Reason'],
		rows: allPapers.map((p) => ({
			title: p.title,
			year: p.publicationYear,
			venue: p.journalName || '—',
			decision: p.isRelevant ? 'Included' : 'Excluded',
			reason: p.isRelevant ? 'Meets relevance criteria' : 'Does not meet relevance criteria'
		}))
	};
}

async function generateDataExtractionMatrix(projectId: string) {
	const relevant = await db
		.select()
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.orderBy(desc(papers.publicationYear));

	const rows = await Promise.all(
		relevant.map(async (p) => {
			const authorList = await db
				.select({ name: authors.name })
				.from(paperAuthors)
				.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
				.where(eq(paperAuthors.paperId, p.id))
				.orderBy(paperAuthors.position);

			return {
				title: p.title,
				authors: authorList.map((a) => a.name).join('; '),
				year: p.publicationYear,
				venue: p.journalName || '—',
				methodology: p.methodologySummary || '—',
				population: p.targetPopulation || '—',
				region: p.focusedRegion || '—',
				platform: p.platformDomain || '—',
				summary: p.summary || '—'
			};
		})
	);

	return {
		columns: ['Title', 'Authors', 'Year', 'Venue', 'Methodology', 'Population', 'Region', 'Platform', 'Summary'],
		rows
	};
}

async function generateSystematicMapTable(projectId: string) {
	const relevant = await db
		.select({ id: papers.id, title: papers.title, publicationYear: papers.publicationYear })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)));

	const rows = await Promise.all(
		relevant.map(async (p) => {
			const tags = await db
				.select({ dimension: analysisTags.dimension, value: analysisTags.value })
				.from(analysisTags)
				.where(eq(analysisTags.paperId, p.id));

			const tagMap: Record<string, string> = {};
			for (const t of tags) tagMap[t.dimension] = t.value;

			return { title: p.title, year: p.publicationYear, ...tagMap };
		})
	);

	// Collect all dimension names as columns
	const dimensionSet = new Set<string>();
	rows.forEach((r) => Object.keys(r).forEach((k) => { if (k !== 'title' && k !== 'year') dimensionSet.add(k); }));

	return {
		columns: ['Title', 'Year', ...Array.from(dimensionSet)],
		rows
	};
}

async function generateStudyCharacteristicsTable(projectId: string) {
	const relevant = await db
		.select()
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.orderBy(desc(papers.publicationYear));

	return {
		columns: ['Title', 'Year', 'Methodology', 'Population', 'Region', 'Platform/Domain'],
		rows: relevant.map((p) => ({
			title: p.title,
			year: p.publicationYear,
			methodology: p.methodologySummary || '—',
			population: p.targetPopulation || '—',
			region: p.focusedRegion || '—',
			platform: p.platformDomain || '—'
		}))
	};
}

async function generateBibliometricAnalysis(projectId: string) {
	const byYear = await db
		.select({ year: papers.publicationYear, count: sql<number>`COUNT(*)` })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(papers.publicationYear)
		.orderBy(papers.publicationYear);

	const byVenue = await db
		.select({ venue: papers.journalName, count: sql<number>`COUNT(*)` })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(papers.journalName)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(15);

	const topAuthors = await db
		.select({ name: authors.name, count: sql<number>`COUNT(DISTINCT ${papers.id})` })
		.from(paperAuthors)
		.innerJoin(authors, eq(paperAuthors.authorId, authors.id))
		.innerJoin(papers, eq(paperAuthors.paperId, papers.id))
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(authors.id)
		.orderBy(desc(sql`COUNT(DISTINCT ${papers.id})`))
		.limit(15);

	const topKeywords = await db
		.select({ term: keywords.term, count: sql<number>`COUNT(*)` })
		.from(paperKeywords)
		.innerJoin(keywords, eq(paperKeywords.keywordId, keywords.id))
		.innerJoin(papers, eq(papers.id, paperKeywords.paperId))
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.groupBy(keywords.term)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(20);

	const data = { byYear, byVenue, topAuthors, topKeywords };

	// Generate markdown tables for human-readable rendering
	let md = '# Bibliometric Analysis\n\n';

	md += '## Publication Trends by Year\n\n';
	md += '| Year | Papers |\n|------|--------|\n';
	for (const row of byYear) md += `| ${row.year || '—'} | ${row.count} |\n`;

	md += '\n## Top Venues\n\n';
	md += '| Venue | Papers |\n|-------|--------|\n';
	for (const row of byVenue) md += `| ${row.venue || '(unknown)'} | ${row.count} |\n`;

	md += '\n## Top Authors\n\n';
	md += '| Author | Papers |\n|--------|--------|\n';
	for (const row of topAuthors) md += `| ${row.name} | ${row.count} |\n`;

	md += '\n## Top Keywords\n\n';
	md += '| Keyword | Occurrences |\n|---------|-------------|\n';
	for (const row of topKeywords) md += `| ${row.term} | ${row.count} |\n`;

	return { json: data, markdown: md };
}

// ─── LLM-synthesized generators ────────────────────────────────────

async function getRelevantPaperSummaries(projectId: string, limit = 50): Promise<string> {
	const relevant = await db
		.select({ title: papers.title, summary: papers.summary, abstract: papers.abstract, publicationYear: papers.publicationYear })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.limit(limit);

	return relevant
		.map((p, i) => `[${i + 1}] "${p.title}" (${p.publicationYear || '?'})\n${p.summary || p.abstract?.slice(0, 300) || 'No summary'}`)
		.join('\n\n');
}

async function llmGenerate(prompt: string): Promise<string> {
	const { text } = await generateText({ model: getModel(), prompt });
	return text.trim();
}

async function generateNarrativeSummary(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId);

	return llmGenerate(`You are writing the narrative synthesis section of a systematic literature review on "${ctx.projectName}".

Context: ${ctx.projectDescription}

Below are summaries of ${paperSummaries.split('\n\n').length} included studies:

${paperSummaries}

Write a comprehensive narrative synthesis (800-1200 words) that:
1. Organizes findings by major themes
2. Identifies areas of agreement and disagreement across studies
3. Highlights methodological trends
4. Notes geographic and temporal patterns
5. Identifies limitations in the current evidence base

Write in academic prose suitable for publication. Use markdown formatting.`);
}

async function generateThematicSynthesis(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId);

	return llmGenerate(`You are conducting a thematic synthesis of research on "${ctx.projectName}".

${paperSummaries}

Perform a three-stage thematic synthesis:
1. **Line-by-line coding**: Identify key concepts from each study
2. **Descriptive themes**: Group codes into descriptive themes
3. **Analytical themes**: Develop higher-order analytical themes that go beyond the primary studies

Present as a structured markdown document with:
- A list of identified themes (with brief descriptions)
- For each theme: which studies support it (reference by number)
- A final section on cross-cutting patterns and relationships between themes`);
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
	const relevant = await db
		.select({ title: papers.title, doi: papers.doi, publicationYear: papers.publicationYear, summary: papers.summary, abstract: papers.abstract })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.orderBy(papers.publicationYear)
		.limit(50);

	const entries = relevant.map((p, i) =>
		`[${i + 1}] "${p.title}" (${p.publicationYear || '?'})${p.doi ? ` DOI: ${p.doi}` : ''}\nContent: ${p.summary || p.abstract?.slice(0, 400) || 'No summary'}`
	).join('\n\n');

	return llmGenerate(`Generate an annotated bibliography for these ${relevant.length} papers. For each entry, write:
1. A standard citation line
2. A 2-3 sentence annotation: what the study does, its methodology, and its key findings

Papers:
${entries}

Format as a numbered markdown list. Each entry should have the citation in bold followed by the annotation paragraph.`);
}

async function generateGapMap(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId, 30);

	return llmGenerate(`You are creating a research gap map for a systematic review on "${ctx.projectName}".

${paperSummaries}

Create a structured research gap map in markdown that identifies:
1. **Well-covered areas** — topics with strong evidence (many studies)
2. **Under-researched areas** — topics with few or no studies
3. **Methodological gaps** — missing research approaches
4. **Geographic gaps** — under-represented regions
5. **Temporal gaps** — time periods with insufficient coverage
6. **Population gaps** — under-studied groups

Present as a structured markdown document with clear headings and bullet points. For each gap, suggest a potential research question to address it.`);
}

async function generateQualityAppraisalTable(projectId: string) {
	const ctx = await loadPromptContext(projectId);
	const relevant = await db
		.select({ id: papers.id, title: papers.title, methodologySummary: papers.methodologySummary })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.limit(30);

	const paperList = relevant.map((p, i) =>
		`[${i + 1}] "${p.title}"\nMethodology: ${p.methodologySummary || 'Not specified'}`
	).join('\n\n');

	const response = await llmGenerate(`You are appraising the quality of studies in a review on "${ctx.projectName}".

${paperList}

For each study, assess quality on these criteria (score 0-2: 0=not met, 1=partially met, 2=fully met):
1. Clear research objectives
2. Appropriate methodology
3. Adequate sample/data
4. Valid analysis
5. Clear reporting of results

Respond with a JSON array where each object has: "index" (1-based), "title", "scores" (object with criteria names as keys and 0/1/2 as values), "totalScore", "quality" ("high"/"medium"/"low").

Respond ONLY with valid JSON array.`);

	const cleaned = response.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
	try {
		const rows = JSON.parse(cleaned);
		return {
			columns: ['Title', 'Objectives', 'Methodology', 'Sample', 'Analysis', 'Reporting', 'Total', 'Quality'],
			rows: rows.map((r: any, i: number) => ({
				title: relevant[i]?.title || r.title,
				...r.scores,
				totalScore: r.totalScore,
				quality: r.quality
			}))
		};
	} catch {
		return { columns: ['Error'], rows: [{ error: 'Failed to parse quality appraisal' }] };
	}
}

async function generateRiskOfBiasTable(projectId: string) {
	const ctx = await loadPromptContext(projectId);
	const relevant = await db
		.select({ id: papers.id, title: papers.title, methodologySummary: papers.methodologySummary })
		.from(papers)
		.where(and(eq(papers.projectId, projectId), eq(papers.isRelevant, true)))
		.limit(30);

	const paperList = relevant.map((p, i) =>
		`[${i + 1}] "${p.title}"\nMethodology: ${p.methodologySummary || 'Not specified'}`
	).join('\n\n');

	const response = await llmGenerate(`Assess risk of bias for these studies in a review on "${ctx.projectName}".

${paperList}

For each study, assess bias risk across these domains (rate as "low", "high", or "unclear"):
1. Selection bias
2. Performance bias
3. Detection bias
4. Attrition bias
5. Reporting bias

Respond with a JSON array where each object has: "index", "title", "biases" (object with domain names as keys), "overall" ("low"/"high"/"unclear").

Respond ONLY with valid JSON array.`);

	const cleaned = response.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
	try {
		const rows = JSON.parse(cleaned);
		return {
			columns: ['Title', 'Selection', 'Performance', 'Detection', 'Attrition', 'Reporting', 'Overall'],
			rows: rows.map((r: any, i: number) => ({
				title: relevant[i]?.title || r.title,
				...r.biases,
				overall: r.overall
			}))
		};
	} catch {
		return { columns: ['Error'], rows: [{ error: 'Failed to parse risk of bias assessment' }] };
	}
}

async function generateConceptualFramework(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId, 30);

	return llmGenerate(`Based on these studies in "${ctx.projectName}", develop a conceptual framework.

${paperSummaries}

Create a markdown document that:
1. Identifies the **key concepts** that emerge from the literature
2. Describes the **relationships** between these concepts
3. Proposes a **visual framework** (described textually as boxes and arrows)
4. Explains how this framework synthesizes the existing evidence
5. Identifies where the framework has gaps or weak connections

Write in academic prose. Use markdown headings and bullet points for clarity.`);
}

async function generateSummaryOfFindings(projectId: string): Promise<string> {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId, 40);

	return llmGenerate(`Create a Summary of Findings for a systematic review on "${ctx.projectName}".

${paperSummaries}

Generate a structured Summary of Findings in markdown that includes:
1. **Key findings** — 5-8 major findings organized by theme
2. **Strength of evidence** — how well-supported each finding is (number of studies, consistency)
3. **Practical implications** — what these findings mean for practitioners
4. **Research implications** — what questions remain unanswered
5. **Limitations** — caveats and limitations of the reviewed evidence

Write in clear, concise academic prose.`);
}

async function generateGradeEvidenceTable(projectId: string) {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId, 30);

	const response = await llmGenerate(`Apply the GRADE framework to rate evidence certainty for a review on "${ctx.projectName}".

${paperSummaries}

Identify 3-6 key outcomes/findings from these studies. For each outcome, rate the certainty of evidence using GRADE:
- Start at "High" for RCTs, "Low" for observational
- Downgrade for: risk of bias, inconsistency, indirectness, imprecision, publication bias
- Upgrade for: large effect, dose-response, confounders would reduce effect

Respond with a JSON array where each object has: "outcome", "studies" (number), "certainty" ("High"/"Moderate"/"Low"/"Very Low"), "rationale".

Respond ONLY with valid JSON array.`);

	const cleaned = response.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
	try {
		return { columns: ['Outcome', 'Studies', 'Certainty', 'Rationale'], rows: JSON.parse(cleaned) };
	} catch {
		return { columns: ['Error'], rows: [{ error: 'Failed to parse GRADE evidence table' }] };
	}
}

async function generateCodingFramework(projectId: string) {
	const ctx = await loadPromptContext(projectId);
	const paperSummaries = await getRelevantPaperSummaries(projectId, 30);

	const response = await llmGenerate(`Develop a coding framework/taxonomy for a review on "${ctx.projectName}".

${paperSummaries}

Create a hierarchical coding framework by:
1. Identifying top-level categories (4-8)
2. Breaking each into sub-codes (2-5 per category)
3. For each code, listing which studies (by number) it applies to

Respond with a JSON object: { "categories": [{ "name", "description", "codes": [{ "name", "description", "studyIndices": [1,3,5] }] }] }

Respond ONLY with valid JSON.`);

	const cleaned = response.replace(/^```json?\s*/, '').replace(/```\s*$/, '');
	try {
		return JSON.parse(cleaned);
	} catch {
		return { categories: [{ name: 'Error', description: 'Failed to parse coding framework', codes: [] }] };
	}
}
