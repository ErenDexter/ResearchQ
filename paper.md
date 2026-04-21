---
title: 'ResearchQ: A self-hosted, AI-assisted platform for systematic literature reviews'
tags:
  - systematic literature review
  - evidence synthesis
  - PRISMA
  - Cochrane
  - scoping review
  - research software
  - OpenAlex
  - large language models
  - LLM-assisted screening
  - reproducible research
authors:
  - name: Ranat Das Prangon
    orcid: 0009-0001-5593-8384
    affiliation: 1
  - name: Istiaque Ahmed
    orcid: 0000-0002-3112-6568
    affiliation: 2  
  - name: Souvik Mandol
    orcid: 0009-0009-0159-9899
    affiliation: 1  
affiliations:
  - name: Bangladesh University of Engineering and Technology (BUET), Dhaka, Bangladesh
    index: 1
  - name: Osaka Metropolitan University
    index: 2
date: 21 April 2026
bibliography: paper.bib
---

# Summary

Systematic literature reviews (SLRs) are the methodological backbone of evidence-based research, yet the mechanics of running one — searching multiple databases, screening hundreds of titles, extracting structured data from each included paper, and assembling reporting deliverables that comply with guidelines such as PRISMA [@page2021prisma] or the Cochrane Handbook [@higgins2023cochrane] — remain labor-intensive and error-prone. Review teams typically stitch together spreadsheets, reference managers, and database search interfaces, which makes a review's search strategy hard to reproduce and its screening decisions hard to audit.

`ResearchQ` is an open-source, self-hosted platform that integrates the whole SLR workflow behind a single interface. It uses the OpenAlex academic graph [@priem2022openalex] as its discovery layer, a provider-agnostic adapter for large language models (LLMs) for relevance screening and metadata extraction, and a pluggable review-methodology engine that ships with eighteen peer-reviewed frameworks (PRISMA, PRISMA-ScR [@tricco2018prismascr], Cochrane, Kitchenham SLR Guidelines [@kitchenham2007slr], Arksey & O'Malley [@arksey2005scoping], JBI Scoping Review [@peters2020jbi], PICO / SPIDER [@cooke2012spider], ENTREQ [@tong2012entreq], Meta-ethnography, GRADE [@guyatt2008grade], CASP, Newcastle–Ottawa Scale, SANRA, Whittemore & Knafl [@whittemore2005integrative], PROSPERO, SLURP, Mapping Studies, plus a custom option). Every search, screening decision, and AI-generated extraction is logged to a local database, making the entire review reproducible from raw query to final deliverable.

The tool runs entirely on a researcher's own machine using SQLite and Node.js — no SaaS dependency, no vendor lock-in, and no paper data leaving the user's disk.

# Statement of need

Conducting an SLR under guidelines such as PRISMA or the Cochrane Handbook requires (i) searching several bibliographic databases with carefully reformulated queries, (ii) de-duplicating and screening hundreds to thousands of titles and abstracts, (iii) extracting a structured matrix of methodological, population, and outcome variables from each included paper, and (iv) producing reporting artifacts such as flow diagrams, evidence tables, and narrative syntheses. Experienced teams routinely report that a rigorous review consumes months of calendar time and is hard to reproduce because the search strategy, screening decisions, and extractions live in separate tools (reference managers, spreadsheets, web forms).

Existing tooling leaves a gap that ResearchQ is designed to fill. Commercial platforms such as Covidence and DistillerSR cover most of the workflow but are closed-source, subscription-based, and keep researchers' data behind a vendor boundary. Rayyan [@ouzzani2016rayyan] is free and popular for collaborative screening but does not integrate discovery, methodology-aware output generation, or synthesis. EPPI-Reviewer is feature-rich but is desktop- and licence-constrained, with a steep learning curve. Open-source tools for a given stage exist (for example, ASReview for active-learning screening) but do not provide an end-to-end, methodology-integrated pipeline.

ResearchQ targets PhD students, postdoctoral researchers, faculty, and research labs who need (a) a reproducible audit trail of every search and decision, (b) methodological fidelity to the guideline they are following, (c) a reasonable degree of automation for the mechanical parts of screening and extraction, and (d) full control over where their data lives. The tool's core contribution is that all of those concerns are addressed inside a single open-source application that can be run locally in under five minutes.

# State of the field

The closest comparators in scope are summarized below.

- **Covidence** is the most widely used commercial SLR platform. It offers excellent guideline support and team workflows but is proprietary, cloud-hosted, and priced per project; researchers cannot self-host, inspect, or extend it [@covidence2024].
- **Rayyan** [@ouzzani2016rayyan] is a free web application focused on the screening stage. It introduced machine-learning suggestions for inclusion/exclusion but does not cover database discovery, methodology-specific phases, or synthesis output generation.
- **EPPI-Reviewer** and **DistillerSR** are enterprise-grade tools that cover the full workflow but at a cost (licence fees, institutional setup, and training overhead) that is difficult to justify for individual researchers or smaller labs [@distillersr2024].

ResearchQ differs from all three in three ways. First, it is MIT-licensed and designed to run locally (SQLite + Node.js) so that paper data, AI prompts, and extracted metadata never leave the researcher's machine. Second, it treats review methodologies as first-class entities: choosing PRISMA vs. Arksey & O'Malley vs. Kitchenham changes the phase stepper, the expected outputs, and the prompts used for AI assistance. Third, it exposes the full AI pipeline — every prompt, every extracted field, every confidence score — as inspectable, editable, and overridable data rather than as opaque service calls.

# Software design

`ResearchQ` is a SvelteKit application whose server-side modules are deliberately organized so that each concern can be tested, swapped, or reused in isolation.

- **Database layer** (`src/lib/server/db/`) is dialect-agnostic. Schema files `schema.sqlite.ts` and `schema.pg.ts` declare the same tables under Drizzle ORM's SQLite and Postgres dialects; a runtime shim (`schema.ts`) selects the active dialect from the `DB_DIALECT` environment variable. The default is SQLite for zero-configuration local use; Postgres is supported without code changes for teams that want a shared deployment.
- **LLM layer** (`src/lib/server/llm.ts`) is provider-agnostic. A single `getModel()` factory switches between the Vercel AI Gateway and direct Google AI Studio based on `LLM_PROVIDER`, normalizes model identifiers across both formats, and is the sole entry point for every AI call. The model itself is configured via the `LLM` environment variable.
- **Discovery** (`src/lib/server/openalex.ts`) wraps the OpenAlex API and exposes six search strategies: journal, author, topic, publisher-scoped database search with resumable cursors, forward citations ("cited by"), and backward citations ("references"). Database searches write their pagination cursors to the database so a long-running search can be resumed after an interruption.
- **AI services** (`gemini.ts`, `project-setup.ts`, `literature-review.ts`, `research-intelligence.ts`) implement four distinct AI tasks: project setup (keyword and dimension generation from a domain description), batched relevance screening, per-paper metadata extraction, and synthesis output generation for each of the twenty supported review deliverables.
- **Methodology engine** is data-driven. The eighteen built-in methodologies are seeded from `src/lib/server/db/seed-methodologies.ts`, each declared as a list of phases with expected outputs. Adding a new methodology is a single JSON-shaped entry; no application code changes.
- **Prompts** live in a single file (`src/lib/server/prompts.ts`) so that every AI call ResearchQ makes can be audited without grepping through service code.

Key design decisions worth noting: (i) AI prompts are dynamically composed from the user's project description so that "relevance" for a given project is the user's definition, not a generic classifier; (ii) the search pipeline stores raw OpenAlex results in a works cache before processing, so that a failure in screening or extraction does not require re-fetching from OpenAlex; (iii) every review output is traceable back to the search job(s) that produced the papers and the prompt that produced the extraction, giving the review an end-to-end audit trail.

# Research impact

ResearchQ is a new tool and does not yet have adoption metrics; its credible research value is instead grounded in methodological fidelity and reproducibility. Specifically:

- **Methodological fidelity.** The eighteen built-in frameworks and their phase structures follow their source publications (PRISMA 2020 [@page2021prisma], Cochrane [@higgins2023cochrane], Kitchenham [@kitchenham2007slr], JBI [@peters2020jbi], Arksey & O'Malley [@arksey2005scoping], and others). Auto-generated artifacts such as PRISMA flow diagrams and GRADE evidence tables [@guyatt2008grade] derive their counts and ratings from the same underlying records that drove the review, eliminating the manual transcription errors typical of spreadsheet-driven workflows.
- **Reproducibility.** Every database query, screening decision, and extraction is persisted with a timestamp and, where applicable, the prompt version that produced it. A review conducted in ResearchQ can therefore be re-executed against a fresh OpenAlex snapshot without re-deriving the search strategy.
- **Accessibility.** The local SQLite mode means a researcher with a laptop and an LLM API key can run a full review workflow in under five minutes, lowering the cost-of-entry compared to commercial or institutional tools.

<!-- [TODO: once ResearchQ has been used in a published SLR, cite that study here and summarize how it informed the methodology. Until then, this paragraph should not claim external adoption that does not yet exist.] -->

# AI usage disclosure

Per the 2026 JOSS guidelines on disclosure of generative AI use, we disclose the following.

**In the software itself.** Generative AI is a core runtime feature. The tool uses a Gemini model (default: `gemini-2.0-flash`) for four tasks: project setup (generating keywords, analysis dimensions, and relevance criteria from a domain description), relevance screening (classifying papers as in- or out-of-scope with a confidence score), metadata extraction (summary, methodology, population, region, platform, keywords from title + abstract), and synthesis output generation for review deliverables such as narrative summaries and coding frameworks. All AI outputs are stored, inspectable, and user-overridable; the prompts are in a single file (`src/lib/server/prompts.ts`) to make the pipeline auditable.

**In the writing of this paper.** <!-- [TODO: author to confirm: "This paper was written without the use of generative AI." OR "Portions of this paper were drafted with generative AI assistance and subsequently reviewed and edited by the authors; all claims were verified against the source code and cited literature."] -->

# Acknowledgments

The authors thank the maintainers of OpenAlex for providing an open, high-quality academic graph; the maintainers of SvelteKit, Drizzle, and `better-sqlite3` for the foundational open-source stack.

# References
