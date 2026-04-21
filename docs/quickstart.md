# Quick start

This walks through running your first literature review end-to-end: from a fresh install to an exported cross-reference matrix. Budget 10–15 minutes.

**Prerequisites:** you have ResearchQ running locally. If not, see [installation.md](installation.md) first.

---

## 1. Create your first project

On first launch, the app redirects you to `/projects/new`. Fill in two fields:

1. **Project Name** — short and specific. Example: *Algorithmic Bias in Criminal Justice*.
2. **Research Domain** — a 3–5 sentence description of what you're studying, which populations or settings matter, and what counts as in-scope vs. out-of-scope.

Tip: the more concrete this description is, the better the AI-generated keywords and relevance criteria will be. Every tooltip on the page explains what each field does; hover over the ℹ️ icons.

Click **Generate Project Setup with AI**. In ~30 seconds the AI produces:

- A **relevance definition** — a paragraph used in every AI screening prompt.
- **15–25 keywords** — seed terms for discovery.
- **5–10 analysis dimensions** — the columns of your eventual cross-reference matrix.
- **Relevance criteria** — explicit include/exclude rules.

Review the four cards. If anything looks off, click **Re-generate**. When satisfied, click **Looks Good — Start Using Project**.

---

## 2. Run your first search

Navigate to **Search** in the left sidebar. Pick one of six strategies:

| Strategy | When to use |
|---|---|
| Topic | Exploratory — keyword across all of OpenAlex |
| Journal | You know which journals matter in your field |
| Author | You've identified a prolific author |
| Database | Scoped to one publisher (ACM, IEEE, Springer, Elsevier, Wiley, SAGE, etc.) — matches Kitchenham SLR guidelines |
| Cited By | Forward citations from a seminal paper |
| References | Backward citations from a paper |

For a first run, **Topic** search with a narrow keyword (e.g., *recidivism algorithm audit*) is the fastest way to see results. Set:

- **Max results**: 50 (keep it small to start)
- **Date range**: optional; leave empty for all years

Submit. The Jobs page shows live progress:

```
Searching OpenAlex...
Storing: "<paper title>" (12/50) — 12 new, 0 skipped
Filtering relevance: batch 2/4 — 18 relevant so far
Extracting [5/18]: "<paper title>" — 4 done
Done in 42.3s — 50 found, 48 new, 18 relevant, 17 metadata extracted
```

Every step is logged to the database. You can re-run the same search later and it will pick up where it left off without re-fetching papers already stored.

---

## 3. Review screening decisions

Open **Papers** in the sidebar. You'll see every paper the search returned, tagged **Relevant** or **Not Relevant** by the AI with a confidence score.

- Click a row to expand the paper, read the abstract, and see the AI's reasoning.
- Click the Relevant/Not-Relevant toggle to override any decision. Your override is persisted.
- Filter by year, region, platform, or full-text search.

This is also where you'd correct obvious AI mistakes — the AI isn't infallible, and the tool assumes you have the last word.

---

## 4. Explore the cross-reference matrix

Open **Cross-Reference** in the sidebar. This is the comparison table most reviews eventually need: one row per relevant paper, columns for title, year, authors, venue, methodology, region, platform, population.

- Click any column header to sort.
- Use the filter inputs at the top to narrow by year range, region, platform, or free-text.
- Click a row to expand full metadata and analysis tags.

Export options at the top right:

- **CSV** — for Excel, Google Sheets, R, SPSS.
- **BibTeX** — for LaTeX, Zotero, Mendeley, EndNote.
- **JSON** — for custom analysis pipelines.

---

## 5. Apply a review methodology

Open **Literature Review** in the sidebar → **New Review**. Pick a methodology:

- **PRISMA** — the most common starting point for systematic reviews.
- **PRISMA-ScR** — for scoping reviews.
- **Kitchenham SLR Guidelines** — for software-engineering reviews.
- …or any of the other 15 built-in frameworks. See [methodologies.md](methodologies.md) for the full list.

The tool creates a **phase stepper** tailored to the methodology. For PRISMA you'll see Protocol → Identification → Screening → Eligibility → Quality Assessment → Data Extraction → Synthesis → Reporting.

Inside each phase:

- Add your observations as free-text notes.
- Click **Generate** next to any expected output. The tool produces deliverables from your existing paper data — for example, a **PRISMA flow diagram** (auto-counted from the pipeline), a **data-extraction matrix** (from the cross-reference), a **GRADE evidence table** (AI-generated from extracted metadata).

You can download each output as Markdown or DOCX, or export the complete review as a single bundled report.

---

## What to do next

- Experiment with multiple search strategies to broaden coverage (snowball from a seminal paper by running a **Cited By** search on it).
- Revisit the project settings (`/projects/<id>/settings`) to refine the relevance definition if you notice the AI drifting from your intent — the updated definition applies to every future screening call.
- Check the **Intelligence** page for gap analysis, author networks, and keyword trends once you have ~50+ relevant papers.
- When ready, tag a stable version of your review in the methodology stepper and export the full bundle for your manuscript.

For deeper dives:

- [methodologies.md](methodologies.md) — reference for all 18 built-in frameworks.
- [architecture.md](architecture.md) — how the pipeline works under the hood.
- [configuration.md](configuration.md) — changing models, switching LLM providers, tuning prompts.
- [faq.md](faq.md) — data privacy, cost, and rate-limit questions.
