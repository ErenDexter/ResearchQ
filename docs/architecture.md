# Architecture

A reader who wants to contribute to ResearchQ or understand *why* the code is shaped the way it is should read this document. It's about 10 minutes.

---

## Big picture

ResearchQ is a [SvelteKit](https://kit.svelte.dev/) application with a Node.js adapter. The browser is a thin client: all AI calls, database access, and OpenAlex requests happen on the server. There is no separate backend service — SvelteKit's `+server.ts` files are the API layer and the `+page.svelte` files are the UI. This keeps the stack small (one language, one framework, one process) and makes the tool trivial to self-host.

```
 ┌──────────────────────────────────┐
 │           Browser (UI)           │
 │        Svelte 5 components       │
 └──────────────┬───────────────────┘
                │ fetch
 ┌──────────────▼───────────────────┐
 │   SvelteKit server routes (API)  │
 │        src/routes/api/**         │
 └──────┬──────────┬────────────────┘
        │          │
        │          │  calls into
        ▼          ▼
 ┌──────────┐  ┌─────────────────────────────┐
 │ OpenAlex │  │   Server modules            │
 │ (HTTP)   │  │   src/lib/server/*          │
 └──────────┘  │                             │
               │   db/  • llm.ts             │
               │   gemini.ts                 │
               │   openalex.ts               │
               │   project-setup.ts          │
               │   literature-review.ts      │
               │   research-intelligence.ts  │
               │   prompts.ts • export.ts    │
               └────────┬────────────────────┘
                        │
                        ▼
               ┌────────────────────┐
               │ SQLite OR Postgres │
               │ (via Drizzle ORM)  │
               └────────────────────┘
```

Everything server-side is under `src/lib/server/`. The module boundaries are deliberate — each module has one concern and minimal dependencies on the others.

---

## Server modules

### `db/` — dialect-agnostic data layer

Three files form the schema system:

- **`schema.sqlite.ts`** — tables under `drizzle-orm/sqlite-core` (`sqliteTable`, `integer({ mode: 'boolean' })`, `real`, ISO-8601 timestamps with `CURRENT_TIMESTAMP` defaults).
- **`schema.pg.ts`** — the same tables under `drizzle-orm/pg-core` (`pgTable`, `boolean`, `doublePrecision`, `now()::text` timestamps).
- **`schema.ts`** — a runtime shim that picks one based on `DB_DIALECT` and re-exports every table name.

The runtime client is in **`index.ts`**. It instantiates either a `better-sqlite3` drizzle client (default) or a `postgres-js` drizzle client. SQLite mode enables WAL and foreign-key pragmas and auto-creates the data directory. The exported `db` is typed as the SQLite flavor so call sites get query-builder inference; at runtime the dialect is transparent.

The remaining file in this folder, **`seed-methodologies.ts`**, is the single source of truth for the 18 built-in review methodologies.

### `llm.ts` — provider-agnostic LLM factory

Every AI call goes through `getModel()` in this file. It reads `LLM_PROVIDER`, `LLM`, and the matching API key, and returns a Vercel AI SDK `LanguageModel`. Supports two providers:

- **`gateway`** — Vercel AI Gateway (`createGateway`). Model IDs use `<vendor>/<model>` form.
- **`google`** — Google AI Studio direct (`@ai-sdk/google`). Model IDs are native (no prefix).

The factory normalizes model IDs in both directions so `google/gemini-2.0-flash` and `gemini-2.0-flash` both work regardless of which provider is active.

### `gemini.ts` — four AI tasks

Exports four functions, each using `getModel()`:

- `filterRelevance(papers, ctx)` — batched binary classification with confidence score.
- `extractMetadata(paper, ctx)` — per-paper structured extraction (summary, methodology, population, region, platform, keywords).
- `classifyAnalysisFramework(paper, ctx)` — maps a paper onto the project's custom analysis dimensions.
- `evaluateKeywordRelevance(keywords, ctx)` — scores candidate keywords for inclusion in the project's seed list.

The `ctx: PromptContext` is built by `project-context.ts` from the project's relevance definition, criteria, and dimensions — so "relevance" always means *this project's* definition of relevance, not a generic classifier.

### `openalex.ts` — discovery adapter

Wraps the OpenAlex HTTP API. Exposes six search strategies:

- journal — all papers from a venue
- author — all papers by an author
- topic — keyword search across OpenAlex
- database — scoped to a single publisher (ACM, IEEE, Springer, etc.), **with cursor-resumable pagination**
- citation forward — papers citing a given paper
- citation backward — papers a given paper cites

Results are written first to the `job_works_cache` table (raw OpenAlex JSON), then processed by the rest of the pipeline. This separation means a failure in screening or extraction doesn't require re-fetching from OpenAlex.

### `project-setup.ts` — new-project wizard

Single function: `generateProjectSetup(name, description)`. Takes the user's domain description, returns the four artifacts reviewed on step 3 of the creation form: relevance definition, relevance criteria (relevant + not-relevant bullet lists), analysis dimensions, and keyword seeds.

### `literature-review.ts` — 20 output generators

The largest server module. For each of the 20 review-output types, there's a generator — some are data-driven (SQL-aggregated counts, tables derived from extracted metadata), some are AI-synthesized (narrative summaries, coding frameworks), some are hybrid (GRADE evidence tables use extracted fields + AI to assign certainty ratings).

The registry of output types is in `OUTPUT_TYPE_REGISTRY` at the top of the file — adding a new output type is a matter of adding an entry to this registry and writing a generator.

### `research-intelligence.ts` — bird's-eye analytics

Gap analysis (AI-generated), prolific authors, co-authorship networks, keyword trends, duplicate detection via title similarity. These power the Intelligence page.

### `prompts.ts` — single source for all prompts

Every prompt string the tool uses lives here. This is an intentional design decision: it lets reviewers, users, and contributors audit the full AI surface without grepping through service code, and it makes prompt iteration a single-file concern.

### `project-context.ts`

Loads a `PromptContext` for a given project ID — the relevance definition, criteria, dimensions, and project description. Used by every `gemini.ts` function.

### `job-queue.ts` + `jobs.ts`

Resumable search-pipeline orchestration. A search job has phases (search → store → filter → extract → keywords) tracked on the `search_jobs` table. If a phase fails, retry picks up from `lastPhase` rather than restarting. The `completedPhases` array lets the UI show a live progress breakdown.

### `export.ts` + `docx-export.ts`

Converters: cross-reference records → CSV / BibTeX / JSON. `docx-export.ts` uses the `docx` library to build Word documents for the review-output bundle.

---

## Database schema (overview)

Twenty-two tables, grouped conceptually:

| Group | Tables |
|---|---|
| **Projects** | `projects`, `project_dimensions` |
| **Content** | `papers`, `authors`, `paper_authors`, `journals`, `paper_journals`, `keywords`, `paper_keywords`, `project_keywords` |
| **Search pipeline** | `search_jobs`, `search_cursors`, `job_works_cache`, `search_plans`, `search_steps` |
| **Analysis** | `analysis_tags` |
| **Review engine** | `review_methodologies`, `methodology_phases`, `project_reviews`, `review_phase_progress`, `review_outputs` |

All tables use text UUIDs for primary keys (generated application-side with `crypto.randomUUID()`). Foreign-key cascades are set on parent deletion — deleting a project cleans up its papers, dimensions, search jobs, and reviews.

Full schema: [src/lib/server/db/schema.sqlite.ts](../src/lib/server/db/schema.sqlite.ts).

---

## Data flow: a single search

Here's what happens when a user clicks **Search** on the Topic strategy:

1. The UI POSTs to `/api/jobs` with the strategy, query, and limits.
2. A `search_jobs` row is inserted with `status='pending'` and `completedPhases=[]`.
3. The job queue picks up the job. Phase-by-phase:
   - **search** — `openalex.ts` queries OpenAlex, writes raw results to `job_works_cache`.
   - **store** — for each cached work, create/find `papers`, `authors`, `journals` rows; link them.
   - **filter** — batched call to `filterRelevance` in `gemini.ts`; updates `papers.isRelevant`.
   - **extract** — for each relevant paper, calls `extractMetadata` and `classifyAnalysisFramework`; writes `analysis_tags`.
   - **keywords** — calls `evaluateKeywordRelevance` on extracted keywords; adds accepted ones to `project_keywords`.
4. On success, `search_jobs.status='completed'`, `completedAt` set. On failure, `status='failed'` with `error` populated; retry resumes from `lastPhase`.

Every one of those steps is logged and persisted — which is what makes the review reproducible.

---

## Adding new things

| I want to add... | Where to look |
|---|---|
| A new review methodology | [src/lib/server/db/seed-methodologies.ts](../src/lib/server/db/seed-methodologies.ts) — append to `METHODOLOGIES` |
| A new review output type | [src/lib/server/literature-review.ts](../src/lib/server/literature-review.ts) — `OUTPUT_TYPE_REGISTRY` + generator fn |
| A new search strategy | [src/lib/server/openalex.ts](../src/lib/server/openalex.ts) — add a function + call site in the jobs route |
| A new LLM provider | [src/lib/server/llm.ts](../src/lib/server/llm.ts) — add a branch to `getModel()` |
| A new analysis dimension for a specific project | UI: `/projects/<id>/settings` (no code changes — dimensions are per-project data) |
| A new column on an existing table | Update **both** [schema.sqlite.ts](../src/lib/server/db/schema.sqlite.ts) and [schema.pg.ts](../src/lib/server/db/schema.pg.ts) in lockstep, then `pnpm db:push` |
| A new AI prompt | [src/lib/server/prompts.ts](../src/lib/server/prompts.ts) |
