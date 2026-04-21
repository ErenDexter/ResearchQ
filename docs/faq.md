# FAQ

Quick answers to questions that come up often. If yours isn't here, search [existing issues](../../../issues) or open a [discussion](../../../discussions).

---

## Privacy and data handling

### Where does my data live?

With the default SQLite configuration, **everything stays on your machine**. The database file is at `./data/researchq.db` (or wherever `DATABASE_URL` points). Paper titles, abstracts, AI-generated summaries, screening decisions, extracted metadata — all local.

### What gets sent to third-party services?

Two external services are involved in the default workflow:

1. **OpenAlex** — the tool queries the public OpenAlex API for paper discovery. OpenAlex sees your search queries (keywords, author names, journal IDs) and your email if you set `OPENALEX_EMAIL`. It does not see your relevance criteria, AI outputs, or extracted metadata.
2. **Your LLM provider** (Vercel AI Gateway or Google AI Studio) — when the tool runs relevance screening, metadata extraction, or synthesis, it sends the relevant prompt + paper data (title + abstract) to the provider. Each provider has its own data-handling policy:
   - Vercel AI Gateway: see [Vercel's AI policy](https://vercel.com/legal/privacy-policy).
   - Google AI Studio: see [Google's AI Studio terms](https://ai.google.dev/terms) — note that free-tier requests may be used to improve Google's models.

If either of these is a concern for you, consider: using a paid Google AI Studio tier (which opts out of model training), switching to a local-LLM provider (contributions welcome), or running screening manually without the AI assist.

### Can I run without any internet connection?

Partially. OpenAlex requires internet for discovery. The AI layer requires internet for Gemini. The rest of the tool (cross-reference matrix, exports, methodology outputs that don't call the LLM, all the UI) works fully offline once data is in the local database.

### Is my paper data shared across projects?

No. Each project has its own scoped data. Papers, keywords, dimensions, and review outputs are all linked to a `projectId` and filtered at every query.

---

## Costs

### How much does the LLM cost to run?

Ballpark, with default settings (`gemini-2.0-flash` via Vercel AI Gateway):

- **Project setup** (keywords + dimensions + criteria): ~1 call per project, cents.
- **Relevance screening**: batched ~10 papers per call. 500 papers ≈ 50 calls. Pennies to a few dollars on the free tier.
- **Metadata extraction**: 1 call per relevant paper. 200 relevant papers ≈ 200 calls. A few dollars.
- **Synthesis outputs**: 1 call per generated output (narrative summary, GRADE table, etc.). Pennies to a dollar each.

Actual costs depend on model choice and token counts. Both Vercel AI Gateway and Google AI Studio offer usable free tiers that cover most evaluation use. Monitor usage in their dashboards.

### Is there a free way to try this?

Yes. Both supported providers offer free tiers that comfortably cover a first small review (~200 papers total AI touch). Get a Vercel AI Gateway key or a Google AI Studio key and go.

---

## Search pipeline

### Why did my search return fewer results than OpenAlex's web UI shows?

A few common reasons:

1. You set `max_results` too low. Bump it and re-run.
2. Your date range filter excluded many results. Remove it or widen it.
3. OpenAlex's web UI uses slightly different default filters. The tool logs every actual request URL; check the server logs to see the exact query.
4. You have relevance filtering on, so many papers were fetched but screened out. Check the "relevant / total" counts on the Jobs page.

### Can I resume a search that got interrupted?

Yes, for **database** strategies (publisher-scoped). Run the same search again — the tool picks up from the last saved cursor. For other strategies, re-running will re-fetch from the top, but already-stored papers are deduplicated by OpenAlex ID so nothing is duplicated.

### The AI marked a paper as "not relevant" but I disagree. What do I do?

Open the paper (**Papers** page → click a row) and flip the Relevant toggle. Your override is persisted and used downstream (cross-reference matrix, methodology outputs).

If the AI is consistently wrong in the same direction, improve the project's **relevance definition** in `/projects/<id>/settings`. The new definition applies to future screening calls. Past decisions are not re-run automatically, but you can trigger a re-screen from the Jobs page if you need to.

### Why are my AI outputs inconsistent between runs?

LLMs are non-deterministic. The same prompt with the same input can produce slightly different wording. For reproducible scientific work:

- The **extracted metadata** is stored at extraction time — it doesn't change on re-read.
- The **synthesis outputs** can be re-generated; the tool versions them with timestamps.
- If you need byte-identical reproducibility, pin your `LLM` env var to a specific model version and keep the prompts in [src/lib/server/prompts.ts](../src/lib/server/prompts.ts) unchanged.

---

## Methodologies and reviews

### Which methodology should I use?

Depends on your field and research question. See the decision table at the top of [methodologies.md](methodologies.md).

### My methodology isn't on the list. Can I still use the tool?

Yes — create a **Custom** methodology from the Literature Review page. You define your own phases and expected outputs. See [methodologies.md](methodologies.md#custom-methodology).

### Can I use multiple methodologies on the same project?

Yes. A project can have multiple reviews, each running a different methodology against the same underlying paper corpus. Useful when you're doing a scoping review that becomes the basis for a follow-up systematic review.

### How do I export a PRISMA flow diagram?

Apply PRISMA to your project, step through to the Reporting phase (or generate earlier), click **Generate** next to "PRISMA Flow Diagram". The numbers come directly from your search-job history — no manual counting.

---

## Performance

### Why is the first AI call slow?

Cold-start latency on the LLM provider side. Subsequent calls are faster.

### Can I make searches faster?

A few tricks:

- Use **`gemini-2.0-flash`** (default) rather than `gemini-2.5-pro` for relevance screening — flash is fast enough and good enough for most domains.
- Set `OPENALEX_EMAIL` to get into the polite pool.
- For exploratory work, set `max_results=25–50`; expand to hundreds once you've validated the query.
- Turn off relevance filtering on the search form if you want to store everything and filter later.

### The dev server is slow to restart

Cold `pnpm dev` takes ~10–20 seconds on most machines. After that, Vite HMR should be ~1 second for code changes. If it's consistently slow, check that your `node_modules` isn't on a networked filesystem (slow) and that `.svelte-kit/` exists (first build generates it).

---

## Other

### Is there a hosted version I can try without installing?

Not yet. ResearchQ is alpha and intentionally self-hosted. If that changes, it'll be noted on the README.

### Can I use this for a journal-submission review?

Yes. The tool's outputs (PRISMA flow diagrams, cross-reference CSV/BibTeX, DOCX review bundle) are designed for submission. We recommend always manually reviewing AI-generated content before submission — the tool assists, it does not replace editorial judgment.

### How do I cite ResearchQ?

See [CITATION.cff](../CITATION.cff) and the Citation section in the [README](../README.md). A JOSS paper is in preparation; once published, the DOI will be the preferred citation.

### Where's the roadmap?

The [issues tab](../../../issues) is the roadmap. Features labeled `planned` are coming; `help wanted` are open for contributors. Big-picture direction is discussed in [GitHub Discussions](../../../discussions).
