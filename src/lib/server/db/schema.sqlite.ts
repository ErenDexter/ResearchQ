import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Projects ──────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description').notNull(),
	status: text('status').notNull().default('active'),
	relevanceDefinition: text('relevance_definition'),
	relevanceCriteria: text('relevance_criteria'),
	customPromptContext: text('custom_prompt_context'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Project Dimensions ────────────────────────────────────────────
export const projectDimensions = sqliteTable('project_dimensions', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	label: text('label').notNull(),
	description: text('description'),
	position: integer('position').notNull().default(0)
});

// ─── Journals ──────────────────────────────────────────────────────
export const journals = sqliteTable('journals', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	issn: text('issn'),
	openalexId: text('openalex_id'),
	type: text('type').default('journal'),
	publisher: text('publisher'),
	relevanceRank: text('relevance_rank'),
	relevanceScore: real('relevance_score'),
	focusAreas: text('focus_areas'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Authors ───────────────────────────────────────────────────────
export const authors = sqliteTable('authors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	orcid: text('orcid'),
	openalexId: text('openalex_id'),
	affiliation: text('affiliation'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Papers ────────────────────────────────────────────────────────
export const papers = sqliteTable('papers', {
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
	isRelevant: integer('is_relevant', { mode: 'boolean' }),
	sourceType: text('source_type'),
	searchJobId: text('search_job_id'),
	journalName: text('journal_name'),
	citedByCount: integer('cited_by_count'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Paper ↔ Author ────────────────────────────────────────────────
export const paperAuthors = sqliteTable('paper_authors', {
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

// ─── Keywords ──────────────────────────────────────────────────────
export const keywords = sqliteTable('keywords', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	term: text('term').notNull().unique(),
	isBaseKeyword: integer('is_base_keyword', { mode: 'boolean' }).notNull().default(false)
});

// ─── Project ↔ Keyword ─────────────────────────────────────────────
export const projectKeywords = sqliteTable('project_keywords', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	keywordId: text('keyword_id')
		.notNull()
		.references(() => keywords.id, { onDelete: 'cascade' }),
	isBaseKeyword: integer('is_base_keyword', { mode: 'boolean' }).notNull().default(false),
	relevanceScore: real('relevance_score').default(1.0),
	usageCount: integer('usage_count').notNull().default(0)
}, (table) => [
	uniqueIndex('project_keywords_unique').on(table.projectId, table.keywordId)
]);

// ─── Paper ↔ Keyword ───────────────────────────────────────────────
export const paperKeywords = sqliteTable('paper_keywords', {
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

// ─── Paper ↔ Journal ───────────────────────────────────────────────
export const paperJournals = sqliteTable('paper_journals', {
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

// ─── Search Jobs ───────────────────────────────────────────────────
export const searchJobs = sqliteTable('search_jobs', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.references(() => projects.id, { onDelete: 'cascade' }),
	type: text('type').notNull(),
	query: text('query').notNull(),
	status: text('status').notNull().default('pending'),
	totalFound: integer('total_found').default(0),
	relevantCount: integer('relevant_count').default(0),
	progressPct: real('progress_pct').default(0),
	error: text('error'),
	retryCount: integer('retry_count').notNull().default(0),
	maxRetries: integer('max_retries').notNull().default(3),
	lastPhase: text('last_phase'),
	maxResults: integer('max_results'),
	dateFrom: text('date_from'),
	dateTo: text('date_to'),
	skipRelevanceFilter: integer('skip_relevance_filter', { mode: 'boolean' }).notNull().default(false),
	completedPhases: text('completed_phases'),
	statusMessage: text('status_message'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	completedAt: text('completed_at')
});

// ─── Search Cursors ────────────────────────────────────────────────
export const searchCursors = sqliteTable('search_cursors', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	publisherId: text('publisher_id').notNull(),
	publisherName: text('publisher_name').notNull(),
	searchQuery: text('search_query').notNull(),
	nextCursor: text('next_cursor'),
	totalFetched: integer('total_fetched').notNull().default(0),
	lastJobId: text('last_job_id')
		.references(() => searchJobs.id),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
}, (table) => [
	uniqueIndex('search_cursors_unique').on(table.projectId, table.publisherId, table.searchQuery)
]);

// ─── Job Works Cache ───────────────────────────────────────────────
export const jobWorksCache = sqliteTable('job_works_cache', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	jobId: text('job_id')
		.notNull()
		.references(() => searchJobs.id, { onDelete: 'cascade' }),
	openalexId: text('openalex_id').notNull(),
	workData: text('work_data').notNull(),
	stored: integer('stored', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Search Plans ──────────────────────────────────────────────────
export const searchPlans = sqliteTable('search_plans', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	status: text('status').notNull().default('planning'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	completedAt: text('completed_at')
});

// ─── Search Steps ──────────────────────────────────────────────────
export const searchSteps = sqliteTable('search_steps', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	planId: text('plan_id')
		.notNull()
		.references(() => searchPlans.id, { onDelete: 'cascade' }),
	jobId: text('job_id')
		.references(() => searchJobs.id),
	strategy: text('strategy').notNull(),
	status: text('status').notNull().default('proposed'),
	reason: text('reason'),
	position: integer('position').notNull().default(0),
	parentStepId: text('parent_step_id'),
	papersFound: integer('papers_found').notNull().default(0),
	relevantFound: integer('relevant_found').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Analysis Tags ─────────────────────────────────────────────────
export const analysisTags = sqliteTable('analysis_tags', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	paperId: text('paper_id')
		.notNull()
		.references(() => papers.id, { onDelete: 'cascade' }),
	dimension: text('dimension').notNull(),
	value: text('value').notNull()
});

// ─── Review Methodologies ──────────────────────────────────────────
export const reviewMethodologies = sqliteTable('review_methodologies', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description').notNull(),
	type: text('type').notNull(),
	domain: text('domain'),
	isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Methodology Phases ────────────────────────────────────────────
export const methodologyPhases = sqliteTable('methodology_phases', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	methodologyId: text('methodology_id')
		.notNull()
		.references(() => reviewMethodologies.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	position: integer('position').notNull().default(0),
	expectedOutputs: text('expected_outputs')
});

// ─── Project Reviews ───────────────────────────────────────────────
export const projectReviews = sqliteTable('project_reviews', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectId: text('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	methodologyId: text('methodology_id')
		.notNull()
		.references(() => reviewMethodologies.id),
	status: text('status').notNull().default('setup'),
	config: text('config'),
	startedAt: text('started_at'),
	completedAt: text('completed_at'),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// ─── Review Phase Progress ─────────────────────────────────────────
export const reviewPhaseProgress = sqliteTable('review_phase_progress', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	projectReviewId: text('project_review_id')
		.notNull()
		.references(() => projectReviews.id, { onDelete: 'cascade' }),
	phaseId: text('phase_id')
		.notNull()
		.references(() => methodologyPhases.id),
	status: text('status').notNull().default('pending'),
	notes: text('notes'),
	completedAt: text('completed_at')
});

// ─── Review Outputs ────────────────────────────────────────────────
export const reviewOutputs = sqliteTable('review_outputs', {
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
	contentJson: text('content_json'),
	contentMarkdown: text('content_markdown'),
	generatedAt: text('generated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});
