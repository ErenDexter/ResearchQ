# ResearchQ

**AI-powered, self-hosted systematic literature review platform.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-green.svg)](https://nodejs.org/)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-ff3e00.svg)](https://kit.svelte.dev/)
[![Status](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)

ResearchQ turns months of manual paper screening into days of structured, reproducible, AI-assisted research. It combines the [OpenAlex](https://openalex.org/) academic graph (250M+ papers) with Google Gemini to automate the tedious parts of a systematic literature review — discovery, screening, metadata extraction, and synthesis — while keeping the researcher in full control of every decision.

Every search is logged. Every inclusion decision is recorded. Every AI extraction is traceable. The tool is built around 18 peer-reviewed review methodologies (PRISMA, Cochrane, Kitchenham, JBI, GRADE, and others) and exports everything in the formats journals actually require: BibTeX, CSV, DOCX, Markdown, JSON.

It runs entirely on your own machine (SQLite + Node.js) or, if you prefer, on your own Postgres. No SaaS, no vendor lock-in, your data never leaves your disk.

> See [FEATURE-DESCRIPTION.md](FEATURE-DESCRIPTION.md) for the full feature pitch.

---

## Table of contents

- [Project status](#project-status)
- [Screenshots](#screenshots)
- [Quick start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Feature overview](#feature-overview)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Citation](#citation)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Project status

ResearchQ is **alpha**. The core workflow (project setup → search → screening → extraction → review output) is feature-complete, but the tool has not yet undergone peer review and the API surface may change between minor versions until `1.0.0`. A JOSS submission is in preparation.

---

## Screenshots

<!-- [TODO: capture screenshots of the three key views and drop into docs/img/] -->

| | |
|---|---|
| ![Project creation](docs/img/01-project-creation.png) | ![Cross-reference matrix](docs/img/02-cross-reference.png) |
| *Guided project creation — AI generates keywords and analysis dimensions from your domain description.* | *Cross-reference matrix — filter, sort, export to BibTeX / CSV / JSON.* |

![Review phase stepper](docs/img/03-phase-stepper.png)
*Methodology phase stepper — pick PRISMA (or one of 17 other frameworks) and generate every expected output from your paper data.*

---

## Quick start

```bash
# 1. Clone and install
git clone https://github.com/YOUR-USERNAME/ResearchQ.git
cd ResearchQ
pnpm install

# 2. Configure (at minimum: set an LLM API key)
cp .env.example .env
# then edit .env — see Configuration below

# 3. Create the local SQLite database
pnpm db:push

# 4. Run the dev server
pnpm dev
```

Open http://localhost:5173 — you'll be redirected straight to the "Create your first project" form. Describe your research domain in plain language, and the AI will generate keywords, analysis dimensions, and relevance criteria in about 30 seconds.

See [docs/quickstart.md](docs/quickstart.md) for a step-by-step walkthrough from install to first exported cross-reference matrix.

---

## Installation

### Requirements

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (or use `npm` / `yarn` with equivalent commands)
- A **build toolchain** for `better-sqlite3` native bindings:
  - macOS: Xcode command-line tools (`xcode-select --install`)
  - Linux: `build-essential` and `python3`
  - Windows: [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) or Visual Studio Build Tools
- An **LLM API key** — one of:
  - [Vercel AI Gateway](https://vercel.com/ai-gateway) (default, has a free tier)
  - [Google AI Studio](https://aistudio.google.com/apikey) (direct Gemini access)

Detailed install guide and troubleshooting: [docs/installation.md](docs/installation.md).

### Using Postgres instead of SQLite

SQLite is the default and works out of the box for local use. If you want to deploy ResearchQ as a shared service, set `DB_DIALECT=postgres` and point `DATABASE_URL` at your Postgres instance. Then run `pnpm db:push:pg` to apply the schema. See [docs/configuration.md](docs/configuration.md) for details.

---

## Configuration

All configuration lives in `.env`. The authoritative reference is [.env.example](.env.example) — copy it to `.env` and fill in the blanks. Summary:

| Variable | Purpose | Default | Required |
|---|---|---|---|
| `DB_DIALECT` | `sqlite` (local) or `postgres` (cloud) | `sqlite` | No |
| `DATABASE_URL` | SQLite file path **or** Postgres connection string | `./data/researchq.db` | No |
| `LLM_PROVIDER` | `gateway` (Vercel AI Gateway) or `google` (Google AI Studio direct) | `gateway` | No |
| `LLM` | Gemini model ID (e.g. `google/gemini-2.0-flash` or `gemini-2.5-flash`) | `google/gemini-2.0-flash` | No |
| `AI_GATEWAY_KEY` | Vercel AI Gateway key | — | Yes (gateway mode) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio key | — | Yes (google mode) |
| `OPENALEX_EMAIL` | Your email — gets you into OpenAlex's faster "polite" pool | — | Recommended |

---

## Feature overview

| Capability | What it does |
|---|---|
| **Guided project setup** | Describe your domain in plain language; the AI generates 15–25 keywords, 5–10 analysis dimensions, and explicit relevance criteria. |
| **Six search strategies** | Journal, author, topic, database (publisher-scoped), forward citations, backward citations — all over OpenAlex, all logged. |
| **AI relevance screening** | Gemini classifies every paper against your project's relevance criteria with confidence scores. Manual override always available. |
| **Metadata extraction** | Summary, methodology, population, region, platform, keywords extracted from each relevant paper's title + abstract. |
| **Cross-reference matrix** | Sortable, filterable, exportable comparison table across all papers. |
| **18 review methodologies** | PRISMA, PRISMA-ScR, Cochrane, Kitchenham, Arksey & O'Malley, JBI, PICO/PICOS/PICOT, SPIDER, ENTREQ, Meta-ethnography, GRADE, CASP, Newcastle-Ottawa, SANRA, Whittemore & Knafl, PROSPERO, SLURP, Mapping Studies, plus custom. |
| **20 review outputs** | PRISMA flow diagrams, data-extraction matrices, GRADE evidence tables, narrative syntheses, coding frameworks, and more — each generated automatically from your paper data. |
| **Research intelligence** | Prolific authors, co-authorship networks, keyword trends, AI-driven gap analysis, duplicate detection. |
| **Export** | BibTeX, CSV, JSON, Markdown, DOCX. |

Full feature tour: [FEATURE-DESCRIPTION.md](FEATURE-DESCRIPTION.md).

---

## Architecture

ResearchQ is a SvelteKit app with a clean server-side module boundary. The browser is a thin client — all AI calls, database access, and OpenAlex requests happen server-side.

```
src/
├── lib/
│   ├── server/
│   │   ├── db/                  # Dialect-agnostic schema + client
│   │   │   ├── schema.sqlite.ts # SQLite tables
│   │   │   ├── schema.pg.ts     # Postgres tables
│   │   │   ├── schema.ts        # Runtime shim (picks via DB_DIALECT)
│   │   │   ├── index.ts         # Drizzle client (dual-driver)
│   │   │   └── seed-methodologies.ts
│   │   ├── llm.ts               # Provider-agnostic Gemini factory
│   │   ├── gemini.ts            # Relevance, extraction, classification
│   │   ├── openalex.ts          # OpenAlex API adapter
│   │   ├── project-setup.ts     # AI project wizard
│   │   ├── literature-review.ts # 20 review-output generators
│   │   ├── research-intelligence.ts # Gap analysis, networks, trends
│   │   ├── project-context.ts   # Per-project prompt context
│   │   ├── prompts.ts           # All AI prompts (single source)
│   │   ├── job-queue.ts         # Resumable search pipeline
│   │   └── export.ts            # BibTeX / CSV / JSON / DOCX
│   └── components/ui/           # Svelte 5 UI primitives
└── routes/                      # SvelteKit pages + API routes
```

Deep dive: [docs/architecture.md](docs/architecture.md).

---

## Documentation

| Doc | Who it's for |
|---|---|
| [docs/installation.md](docs/installation.md) | First-time install + troubleshooting |
| [docs/quickstart.md](docs/quickstart.md) | Step-by-step first-project walkthrough |
| [docs/methodologies.md](docs/methodologies.md) | Reference for all 18 built-in review methodologies |
| [docs/architecture.md](docs/architecture.md) | Server module map + data flow |
| [docs/configuration.md](docs/configuration.md) | Env vars, LLM/provider tradeoffs, model selection |
| [docs/faq.md](docs/faq.md) | Privacy, cost, rate limits, common issues |

---

## Contributing

Contributions are welcome — bug reports, feature ideas, docs, and code.

- Report a bug: [open an issue](../../issues/new?template=bug_report.md)
- Propose a feature: [open a feature request](../../issues/new?template=feature_request.md)
- Ask a question: [start a discussion](../../discussions)
- Send a fix: see [CONTRIBUTING.md](CONTRIBUTING.md)

All project participants are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Citation

If ResearchQ helps your research, please cite it. Machine-readable metadata is in [CITATION.cff](CITATION.cff).

```bibtex
@software{researchq_2026,
  author  = {Das Prangon, Ranat},
  title   = {ResearchQ: AI-powered, self-hosted systematic literature review platform},
  year    = {2026},
  url     = {https://github.com/YOUR-USERNAME/ResearchQ},
  license = {MIT}
}
```

A companion paper is in preparation for the [Journal of Open Source Software](https://joss.theoj.org/). Once published, the DOI will be added here and in `CITATION.cff`.

---

## License

[MIT](LICENSE) © 2026 Ranat Das Prangon

---

## Acknowledgments

ResearchQ is built on the shoulders of:

- [**OpenAlex**](https://openalex.org/) — the open academic graph that makes multi-source discovery possible.
- [**Google Gemini**](https://ai.google.dev/) — the LLM behind relevance screening, extraction, and synthesis.
- [**Vercel AI Gateway**](https://vercel.com/ai-gateway) — lowers the barrier to getting a working LLM key.
- [**SvelteKit**](https://kit.svelte.dev/), [**Drizzle ORM**](https://orm.drizzle.team/), [**better-sqlite3**](https://github.com/WiseLibs/better-sqlite3), [**bits-ui**](https://bits-ui.com/), [**Lucide**](https://lucide.dev/).

### AI usage disclosure

Generative AI is a core runtime feature of ResearchQ (relevance screening, metadata extraction, synthesis output generation) and is disclosed in the [paper.md](paper.md) AI usage section per JOSS 2026 guidelines. All AI-generated outputs are traceable to the prompts in [src/lib/server/prompts.ts](src/lib/server/prompts.ts) and are always reviewable and overridable by the user.
