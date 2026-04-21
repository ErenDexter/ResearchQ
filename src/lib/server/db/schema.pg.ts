import { boolean, doublePrecision, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Projects ──────────────────────────────────────────────────────
export const projects = pgTable('projects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description').notNull(),
	status: text('status').notNull().default('active'), // 'active' | 'archived'
	relevanceDefinition: text('relevance_definition'), // LLM-generated paragraph
	relevanceCriteria: text('relevance_criteria'), // JSON: { relevant: string[], notRelevant: string[] }
	customPromptContext: text('custom_prompt_context'), // optional override
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Project Dimensions (analysis framework per project) ───────────
export const projectDimensions = pgTable('project_dimensions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(), // e.g. "when", "methodology_type"
	label: text('label').notNull(), // e.g. "Timeline", "Methodology Type"
	description: text('description'), // what this dimension measures
	position: integer('position').notNull().default(0)
});

// ─── Journals ───────────────────────────────────────────────────────
export const journals = pgTable('journals', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	issn: text('issn'),
	openalexId: text('openalex_id'),
	type: text('type').default('journal'), // 'journal' | 'conference' | 'proceedings' | 'repository' | 'other'
	publisher: text('publisher'), // e.g. 'ACM', 'IEEE', 'Elsevier', 'Springer', 'Wiley', 'SAGE', 'Taylor and Francis', 'Oxford Academics', 'AIS'
	relevanceRank: text('relevance_rank'), // 'core' | 'relevant' | 'peripheral'
	relevanceScore: doublePrecision('relevance_score'),
	focusAreas: text('focus_areas'), // JSON array of strings
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Authors ────────────────────────────────────────────────────────
export const authors = pgTable('authors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	orcid: text('orcid'),
	openalexId: text('openalex_id'),
	affiliation: text('affiliation'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Papers ─────────────────────────────────────────────────────────
export const papers = pgTable('papers', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.references(() => projects.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	doi: text('doi'),
	openalexId: text('openalex_id').unique(),
	abstract: text('abstract'),
	publicationYear: integer('publication_year'),
	paperUrl: text('paper_url'),
	summary: text('summary'),
	methodologySummary: text('methodology_summary'),
	targetPopulation: text('target_population'),
	focusedRegion: text('focused_region'),
	platformDomain: text('platform_domain'),
	isRelevant: boolean('is_relevant'),
	sourceType: text('source_type'), // 'journal_search' | 'author_search' | 'topic_search' | 'citation_search' | 'related_search'
	searchJobId: text('search_job_id'),
	journalName: text('journal_name'),
	citedByCount: integer('cited_by_count'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Paper ↔ Author (many-to-many) ─────────────────────────────────
export const paperAuthors = pgTable('paper_authors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	paperId: text('paper_id')
		.notNull()
		.references(() => papers.id, { onDelete: 'cascade' }),
	authorId: text('author_id')
		.notNull()
		.references(() => authors.id, { onDelete: 'cascade' }),
	position: integer('position')
}, (table) => [
	uniqueIndex('paper_authors_unique').on(table.paperId, table.authorId)
]);

// ─── Keywords ───────────────────────────────────────────────────────
export const keywords = pgTable('keywords', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	term: text('term').notNull().unique(),
	isBaseKeyword: boolean('is_base_keyword').notNull().default(false)
});

// ─── Project ↔ Keyword (scoped keywords with relevance) ────────────
export const projectKeywords = pgTable('project_keywords', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	keywordId: text('keyword_id')
		.notNull()
		.references(() => keywords.id, { onDelete: 'cascade' }),
	isBaseKeyword: boolean('is_base_keyword').notNull().default(false),
	relevanceScore: doublePrecision('relevance_score').default(1.0),
	usageCount: integer('usage_count').notNull().default(0)
}, (table) => [
	uniqueIndex('project_keywords_unique').on(table.projectId, table.keywordId)
]);

// ─── Paper ↔ Keyword (many-to-many) ─────────────────────────────────
export const paperKeywords = pgTable('paper_keywords', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	paperId: text('paper_id')
		.notNull()
		.references(() => papers.id, { onDelete: 'cascade' }),
	keywordId: text('keyword_id')
		.notNull()
		.references(() => keywords.id, { onDelete: 'cascade' })
}, (table) => [
	uniqueIndex('paper_keywords_unique').on(table.paperId, table.keywordId)
]);

// ─── Paper ↔ Journal ────────────────────────────────────────────────
export const paperJournals = pgTable('paper_journals', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	paperId: text('paper_id')
		.notNull()
		.references(() => papers.id, { onDelete: 'cascade' }),
	journalId: text('journal_id')
		.notNull()
		.references(() => journals.id, { onDelete: 'cascade' })
}, (table) => [
	uniqueIndex('paper_journals_unique').on(table.paperId, table.journalId)
]);

// ─── Search Jobs ────────────────────────────────────────────────────
export const searchJobs = pgTable('search_jobs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.references(() => projects.id, { onDelete: 'cascade' }),
	type: text('type').notNull(), // 'journal' | 'author' | 'topic' | 'citation_forward' | 'citation_backward' | 'related' | 'snowball' | 'database'
	query: text('query').notNull(),
	status: text('status').notNull().default('pending'),
	// 'pending' | 'queued' | 'searching' | 'filtering' | 'extracting' | 'completed' | 'failed'
	totalFound: integer('total_found').default(0),
	relevantCount: integer('relevant_count').default(0),
	progressPct: doublePrecision('progress_pct').default(0),
	error: text('error'),
	retryCount: integer('retry_count').notNull().default(0),
	maxRetries: integer('max_retries').notNull().default(3),
	lastPhase: text('last_phase'), // for resume on retry
	maxResults: integer('max_results'), // cap on papers to fetch (used by database strategy)
	dateFrom: text('date_from'), // YYYY-MM-DD — filter papers published on or after this date
	dateTo: text('date_to'), // YYYY-MM-DD — filter papers published on or before this date
	skipRelevanceFilter: boolean('skip_relevance_filter').notNull().default(false), // if true, skip Gemini Phase 3, mark all as relevant
	completedPhases: text('completed_phases'), // JSON array e.g. ["search","store","filter","extract","keywords"]
	statusMessage: text('status_message'), // live progress detail shown in UI
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`),
	completedAt: text('completed_at')
});

// ─── Search Cursors (resumable pagination for database searches) ────
export const searchCursors = pgTable('search_cursors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	publisherId: text('publisher_id').notNull(),
	publisherName: text('publisher_name').notNull(),
	searchQuery: text('search_query').notNull(),
	nextCursor: text('next_cursor'), // null means exhausted
	totalFetched: integer('total_fetched').notNull().default(0),
	lastJobId: text('last_job_id')
		.references(() => searchJobs.id),
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`now()::text`)
}, (table) => [
	uniqueIndex('search_cursors_unique').on(table.projectId, table.publisherId, table.searchQuery)
]);

// ─── Job Works Cache (OpenAlex results staged for resilient processing) ──
export const jobWorksCache = pgTable('job_works_cache', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	jobId: text('job_id')
		.notNull()
		.references(() => searchJobs.id, { onDelete: 'cascade' }),
	openalexId: text('openalex_id').notNull(),
	workData: text('work_data').notNull(), // full OpenAlexWork JSON
	stored: boolean('stored').notNull().default(false), // Phase 2 processed
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Search Plans (agentic search orchestration) ───────────────────
export const searchPlans = pgTable('search_plans', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	status: text('status').notNull().default('planning'), // 'planning' | 'running' | 'paused' | 'completed'
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`),
	completedAt: text('completed_at')
});

// ─── Search Steps (individual steps within a plan) ──────────────────
export const searchSteps = pgTable('search_steps', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	planId: text('plan_id')
		.notNull()
		.references(() => searchPlans.id, { onDelete: 'cascade' }),
	jobId: text('job_id')
		.references(() => searchJobs.id), // linked when executed
	strategy: text('strategy').notNull(), // JSON SearchStrategy
	status: text('status').notNull().default('proposed'), // 'proposed' | 'approved' | 'running' | 'completed' | 'skipped'
	reason: text('reason'), // LLM explanation for why this step was proposed
	position: integer('position').notNull().default(0),
	parentStepId: text('parent_step_id'), // which step generated this one
	papersFound: integer('papers_found').notNull().default(0),
	relevantFound: integer('relevant_found').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Analysis Tags (analysis-framework dimensions) ──────────────────
export const analysisTags = pgTable('analysis_tags', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	paperId: text('paper_id')
		.notNull()
		.references(() => papers.id, { onDelete: 'cascade' }),
	dimension: text('dimension').notNull(),
	value: text('value').notNull()
});

// ─── Review Methodologies (global library) ──────────────────────────
export const reviewMethodologies = pgTable('review_methodologies', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description').notNull(),
	type: text('type').notNull(), // 'systematic' | 'scoping' | 'meta_analysis' | 'qualitative' | 'mixed' | 'mapping' | 'rapid' | 'custom'
	domain: text('domain'), // 'health' | 'software_engineering' | 'social_sciences' | 'general'
	isBuiltIn: boolean('is_built_in').notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Methodology Phases (steps within a methodology) ────────────────
export const methodologyPhases = pgTable('methodology_phases', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	methodologyId: text('methodology_id')
		.notNull()
		.references(() => reviewMethodologies.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	position: integer('position').notNull().default(0),
	expectedOutputs: text('expected_outputs') // JSON array of output type identifiers
});

// ─── Project Reviews (methodology applied to a project) ─────────────
export const projectReviews = pgTable('project_reviews', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	methodologyId: text('methodology_id')
		.notNull()
		.references(() => reviewMethodologies.id),
	status: text('status').notNull().default('setup'), // 'setup' | 'in_progress' | 'completed'
	config: text('config'), // JSON: method-specific parameters
	startedAt: text('started_at'),
	completedAt: text('completed_at'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`now()::text`)
});

// ─── Review Phase Progress (tracking per phase) ─────────────────────
export const reviewPhaseProgress = pgTable('review_phase_progress', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectReviewId: text('project_review_id')
		.notNull()
		.references(() => projectReviews.id, { onDelete: 'cascade' }),
	phaseId: text('phase_id')
		.notNull()
		.references(() => methodologyPhases.id),
	status: text('status').notNull().default('pending'), // 'pending' | 'in_progress' | 'completed' | 'skipped'
	notes: text('notes'),
	completedAt: text('completed_at')
});

// ─── Review Outputs (generated deliverables) ────────────────────────
export const reviewOutputs = pgTable('review_outputs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectReviewId: text('project_review_id')
		.notNull()
		.references(() => projectReviews.id, { onDelete: 'cascade' }),
	phaseId: text('phase_id')
		.references(() => methodologyPhases.id),
	outputType: text('output_type').notNull(),
	title: text('title').notNull(),
	contentJson: text('content_json'), // structured data for tables/charts
	contentMarkdown: text('content_markdown'), // narrative/text content
	generatedAt: text('generated_at')
		.notNull()
		.default(sql`now()::text`)
});
