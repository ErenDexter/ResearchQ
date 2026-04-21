# ResearchQ — AI-Powered Systematic Literature Review Platform

> **Turn months of manual paper screening into days of structured, reproducible, AI-assisted research.**

ResearchQ is a purpose-built platform for academics conducting systematic literature reviews, scoping reviews, and evidence syntheses. It combines the OpenAlex academic graph (250M+ papers) with Google Gemini AI to automate the tedious parts of literature review — discovery, screening, extraction, and synthesis — while keeping researchers in full control of every decision.

---

## Why Researchers Need This

Literature reviews are the backbone of academic research, yet the process is painfully manual:

- Searching 6+ databases individually, reformulating queries each time
- Screening hundreds of papers by reading titles and abstracts
- Manually extracting methodology, population, and region from each paper
- Building comparison matrices in spreadsheets by hand
- Tracking which papers came from which search, and why they were included or excluded
- Following PRISMA or Cochrane checklists on paper, with no integrated tooling

**ResearchQ replaces this entire workflow with a single, guided platform.** Every search is logged. Every inclusion decision is recorded. Every extraction is AI-assisted. Every output is exportable in formats your journal requires.

---

## Platform Features

### Research Projects — Your Domain, Your Rules

Every research domain is different. ResearchQ doesn't assume what you're studying — instead, it asks you to describe your domain in plain language, then uses AI to generate:

- **15–25 targeted search keywords** tailored to your specific topic
- **5–10 analysis dimensions** for classifying papers (e.g., Timeline, Methodology, Population, Geographic Focus)
- **Relevance criteria** — explicit inclusion/exclusion rules that the AI follows when screening papers
- **A relevance definition** — a paragraph describing what counts as a relevant paper, used in every AI prompt

You review and edit everything before the system starts working. Switch between projects instantly — each has its own papers, keywords, and analysis framework, completely isolated.

**Example:** A professor studying "Algorithmic Bias in Criminal Justice" would get keywords like *algorithmic fairness, recidivism prediction, pretrial risk assessment, racial bias in sentencing, COMPAS algorithm*, and dimensions like *Jurisdiction, Algorithm Type, Affected Population, Bias Metric, Legal Framework*.

---

### Multi-Strategy Paper Discovery

Finding every relevant paper means searching from multiple angles. ResearchQ supports six search strategies, all powered by the OpenAlex academic graph:

| Strategy | What It Does | When to Use |
|----------|-------------|-------------|
| **Journal** | Search all papers from a specific venue | You know the key journals in your field |
| **Author** | Get all papers by a researcher, AI filters for relevance | You've identified prolific authors |
| **Topic** | Keyword search across all venues and authors | Broad exploration of a research area |
| **Database** | Search by publisher (IEEE, ACM, Springer, Elsevier, Wiley, SAGE, etc.) | Following Kitchenham SLR guidelines requiring database-specific searches |
| **Cited By** | Forward citation chain — who cites a known paper? | Snowball sampling from a seminal work |
| **References** | Backward citation chain — what does a paper cite? | Tracing the intellectual lineage |

Every search is tracked with a **live progress feed** showing exactly what the system is doing:

```
Searching OpenAlex (database: "IEEE")...
Storing: "Explainable AI in Healthcare..." (12/50) — 12 new, 0 skipped
Filtering relevance: batch 2/4 — 18 relevant so far
Extracting [5/18]: "Algorithmic Fairness in Hiring..." — 4 done
Evaluating 34 extracted keywords for relevance...
Done in 42.3s — 50 found, 48 new, 18 relevant, 17 metadata extracted
```

**Database searches** are resumable — run the same search again and it automatically picks up where it left off, fetching the next batch of papers without duplicating previous results.

---

### AI-Powered Relevance Screening

After papers are fetched, Gemini AI screens every paper against your project's relevance criteria. This replaces the hours spent reading titles and abstracts manually.

The AI uses your project's specific relevance definition — not a generic classifier. A paper about "algorithmic auditing" in a healthcare project will be evaluated differently than in a software engineering project, because the prompts are dynamically constructed from your project's description.

Papers are classified as **Relevant** or **Not Relevant** with a confidence score. You can always override the AI's decision on any individual paper.

---

### Automated Metadata Extraction

For every relevant paper, the AI extracts structured metadata from the title and abstract:

- **Summary** — 2-line overview of what the paper does
- **Methodology** — research approach used
- **Target Population** — who or what was studied
- **Geographic Region** — where the study was conducted
- **Platform/Domain** — the application area (Healthcare, Hiring, Criminal Justice, etc.)
- **Keywords** — 3–6 domain-specific keywords per paper

This metadata powers the Cross-Reference Matrix, Analysis dashboard, and Literature Review outputs — all generated automatically.

---

### Cross-Reference Matrix

The heart of any systematic review: a comprehensive comparison table showing all your papers side-by-side.

**Columns:** Title, Year, Authors, Venue, Database/Publisher, Methodology, Region, Platform, Population

**Features:**
- Sort by any column (click to toggle ascending/descending)
- Filter by year range, region, platform, and full-text search
- Click any row to expand and see the full summary, keywords, and analysis tags
- External link to the paper's DOI or open-access URL

**Export in three formats:**
- **CSV** — for Excel, Google Sheets, or statistical tools
- **BibTeX** — for LaTeX, Zotero, Mendeley, or any citation manager
- **JSON** — for programmatic analysis

---

### Venue Intelligence

Understand which journals and conferences matter most to your field:

- Venues automatically ranked as **Core**, **Relevant**, or **Peripheral** based on how many relevant papers they publish
- Filter by publisher/database (ACM, IEEE, Springer, Elsevier, Wiley, SAGE, Taylor & Francis, Oxford Academics)
- See paper counts, relevance scores, and ISSN identifiers
- One-click to search a venue directly from its card

---

### Analysis Dashboard

Visualize the landscape of your collected literature:

- **Papers by Year** — horizontal bar chart showing publication trends
- **Geographic Distribution** — where studies are being conducted (top 20 regions)
- **Platform/Domain Distribution** — application areas represented in your corpus
- **Dynamic Analysis Framework** — your project's custom dimensions, each showing the top 10 classification values with counts

The analysis framework is fully dynamic — it uses whatever dimensions your project defines, not a hardcoded set.

---

### Research Intelligence

AI-driven insights that go beyond simple aggregation:

- **Prolific Authors** — top researchers in your corpus with their keyword specialties and institutional affiliations
- **Co-Authorship Network** — which researchers frequently collaborate (top pairs with shared paper counts)
- **Keyword Trends** — how research topics evolve year-over-year
- **Gap Analysis** (AI-powered) — identifies under-researched areas, geographic blind spots, methodological gaps, and suggests specific actions to fill them
- **Duplicate Detection** — flags paper pairs with 85%+ title similarity that may have been collected from different searches

---

### Literature Review Methodologies

**This is the feature that makes ResearchQ indispensable for rigorous academic work.**

ResearchQ includes **18 built-in, academically recognized review methodologies**, each with pre-defined phases and expected outputs:

#### Systematic Reviews
- **PRISMA** — 8 phases (Protocol → Identification → Screening → Eligibility → Quality Assessment → Data Extraction → Synthesis → Reporting)
- **Cochrane Framework** — 8 phases with forest plots, funnel plots, and GRADE evidence rating
- **Kitchenham SLR Guidelines** — 7 phases designed specifically for software engineering
- **PROSPERO** — Protocol registration workflow

#### Scoping Reviews
- **PRISMA-ScR** — 5 phases adapted for scoping reviews
- **Arksey & O'Malley** — 5 phases for social sciences
- **JBI Scoping Review** — 6 phases with Joanna Briggs Institute methodology

#### Question Frameworks
- **PICO / PICOS / PICOT** — Structured clinical question formulation
- **SPIDER** — Qualitative/mixed-methods question framework

#### Qualitative Synthesis
- **ENTREQ** — 5 phases for transparent qualitative evidence synthesis
- **Meta-ethnography (Noblit & Hare)** — 7 phases of interpretive synthesis

#### Evidence Quality
- **GRADE** — Evidence certainty rating (High → Very Low)
- **CASP** — Critical appraisal checklists
- **Newcastle-Ottawa Scale** — Quality assessment for observational studies
- **SANRA** — Narrative review quality assessment

#### Mixed Methods & Mapping
- **Whittemore & Knafl** — Integrative review framework
- **SLURP** — Lightweight SLR for software engineering
- **Mapping Studies** — Systematic evidence mapping with classification schemes

#### Custom Methodologies
Create your own methodology with custom phases and expected outputs. Define what each phase requires and what deliverables it should produce.

---

### Guided Review Execution

When you apply a methodology to your project, ResearchQ creates a **phase-by-phase workflow**:

- **Phase Stepper** — visual progress through each phase (pending → in progress → completed)
- **Per-Phase Notes** — add your observations and decisions at each step
- **Output Generation** — click "Generate" on any expected output and the system creates it from your paper data:

**20 output types available**, including:

| Output | How It's Generated |
|--------|-------------------|
| PRISMA Flow Diagram | Automatic — counts from your search pipeline |
| Inclusion/Exclusion Table | Automatic — all papers with decision and reason |
| Data Extraction Matrix | Automatic — your cross-reference data, filtered |
| Study Characteristics Table | Automatic — papers with methodology, population, region |
| Search Strategy Log | Automatic — all searches with databases, dates, counts |
| Bibliometric Analysis | Automatic — publication trends, top venues, authors, keywords |
| Systematic Mapping Table | Automatic — papers × your analysis dimensions |
| Narrative Summary | AI-generated — coherent synthesis of all findings |
| Thematic Synthesis | AI-generated — themes identified across studies |
| Protocol Document | AI-generated — complete review protocol ready for registration |
| Annotated Bibliography | AI-generated — citation + 2-3 sentence annotation per paper |
| Research Gap Map | AI-generated — under-researched areas with suggested questions |
| Quality Appraisal Table | AI-generated — per-paper quality scoring |
| Risk of Bias Table | AI-generated — per-paper bias domain assessment |
| GRADE Evidence Table | AI-generated — outcome-level certainty ratings |
| Conceptual Framework | AI-generated — key concepts and relationships |
| Summary of Findings | AI-generated — key findings with evidence strength |
| Coding Framework | AI-generated — hierarchical taxonomy with paper mapping |

Every output can be **downloaded individually** in Markdown or DOCX format, or **exported as a complete review report** bundling all outputs into a single document.

---

### Export & Integration

ResearchQ speaks the language of academic tools:

| Format | Use Case |
|--------|----------|
| **CSV** | Excel, Google Sheets, SPSS, R |
| **BibTeX** | LaTeX, Overleaf, Zotero, Mendeley, EndNote |
| **JSON** | Python scripts, custom analysis pipelines |
| **Markdown** | GitHub, Notion, Obsidian, plain text editors |
| **DOCX** | Microsoft Word, Google Docs, journal submissions |

---

## What Makes ResearchQ Different

| Traditional Approach | ResearchQ |
|---------------------|-----------|
| Search each database manually | One platform, six search strategies, all logged |
| Read every title and abstract yourself | AI screens papers against your criteria |
| Build extraction spreadsheets by hand | Metadata extracted automatically |
| Follow PRISMA checklist on paper | Guided phase stepper with auto-generated outputs |
| Spend weeks on a single review | Complete a rigorous review in days |
| Results locked in local spreadsheets | Export to BibTeX, CSV, DOCX, JSON anytime |
| No way to verify reproducibility | Every search, decision, and extraction is logged |

---

## Who Is This For

- **PhD students** conducting their first systematic review and needing methodological guidance
- **Postdocs and faculty** managing multiple review projects across different research domains
- **Research labs** where multiple members contribute to the same literature review
- **Interdisciplinary teams** working across fields (each project has its own domain-specific configuration)
- **Grant applicants** who need a rapid literature landscape analysis to justify their proposal

---

## Technical Foundation

- **Paper data:** OpenAlex academic graph — 250M+ papers, open and free
- **AI engine:** Google Gemini via Vercel AI Gateway — relevance screening, metadata extraction, synthesis
- **Database:** Postgres (Neon) — production-grade, scalable
- **Deployment:** Digital Ocean App Platform — persistent, reliable
- **Framework:** SvelteKit — fast, modern web application

---

*ResearchQ transforms literature review from a months-long manual process into a structured, reproducible, AI-assisted workflow — so researchers can spend their time on insight, not on spreadsheets.*
