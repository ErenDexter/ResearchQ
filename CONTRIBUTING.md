# Contributing to ResearchQ

Thanks for considering a contribution — bug reports, docs, and code are all welcome.

This document covers how to set up a development environment, what kinds of changes are easy to accept, and the mechanics of opening a pull request.

---

## Table of contents

- [Ways to help](#ways-to-help)
- [Reporting a bug](#reporting-a-bug)
- [Proposing a feature](#proposing-a-feature)
- [Asking a question / getting support](#asking-a-question--getting-support)
- [Development setup](#development-setup)
- [Code style and checks](#code-style-and-checks)
- [Pull request process](#pull-request-process)
- [Code of Conduct](#code-of-conduct)

---

## Ways to help

| I want to... | Start here |
|---|---|
| Report a bug | [Open a bug report](../../issues/new?template=bug_report.md) |
| Propose a new feature | [Open a feature request](../../issues/new?template=feature_request.md) |
| Ask a question | [Start a discussion](../../discussions) |
| Fix a typo or improve docs | Send a PR directly — no issue needed |
| Add a new review methodology | See [docs/methodologies.md](docs/methodologies.md#adding-a-methodology) |
| Contribute code | Read this file, then [find a good-first-issue](../../labels/good%20first%20issue) |

---

## Reporting a bug

A good bug report contains:

1. **What you did** — the exact steps, in order.
2. **What you expected to happen.**
3. **What actually happened** — including any error message verbatim (copy-paste; don't paraphrase).
4. **Your environment** — OS, Node version (`node -v`), pnpm version (`pnpm -v`), `DB_DIALECT` and `LLM_PROVIDER` values.
5. **Logs** — if the bug happened during a search or AI call, the server logs from your terminal are usually the single most helpful thing you can attach.

Use the bug report template when opening the issue; it prompts you for each item above.

---

## Proposing a feature

Feature requests are welcome. Before opening one, please search existing issues to avoid duplicates.

A useful feature request explains:

1. **The problem** — what are you trying to do that the tool makes hard?
2. **The user** — who would benefit? A PhD student doing their first review? A lab running reviews across multiple domains?
3. **The shape of a solution** — not necessarily an implementation, but what the end state looks like from the outside.
4. **Alternatives** — what workarounds exist today?

---

## Asking a question / getting support

- **General questions** — use [GitHub Discussions](../../discussions).
- **Methodology questions** — consult [docs/methodologies.md](docs/methodologies.md) first; if your methodology isn't covered, open a discussion.
- **"Is this a bug or am I doing it wrong?"** — open a discussion; we can convert it to an issue if it is a bug.

---

## Development setup

### Prerequisites

- Node.js ≥ 20 (LTS recommended)
- pnpm ≥ 9
- A C/C++ toolchain for `better-sqlite3` native compilation (see [docs/installation.md](docs/installation.md))
- An LLM API key — either a [Vercel AI Gateway](https://vercel.com/ai-gateway) key (free tier works) or a [Google AI Studio](https://aistudio.google.com/apikey) key

### First-time setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/ResearchQ.git
cd ResearchQ

# Install dependencies
pnpm install

# Configure — at minimum set AI_GATEWAY_KEY or GOOGLE_GENERATIVE_AI_API_KEY
cp .env.example .env

# Create the SQLite database
pnpm db:push

# Run the dev server
pnpm dev
```

### Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server at http://localhost:5173 |
| `pnpm build` | Production build |
| `pnpm preview` | Preview the production build locally |
| `pnpm check` | Svelte + TypeScript type checks |
| `pnpm format` | Prettier auto-format |
| `pnpm lint` | Prettier check only (no writes) |
| `pnpm db:push` | Sync the schema to the SQLite database |
| `pnpm db:studio` | Open Drizzle Studio to inspect the database |

---

## Code style and checks

Before opening a PR, please run:

```bash
pnpm check    # type checks must pass
pnpm lint     # formatting must pass
```

Quick conventions:

- **TypeScript** — prefer explicit types at module boundaries; `any` is rarely the right answer.
- **Svelte 5** — use runes (`$state`, `$derived`, `$effect`) and snippets. No `on:click` (use `onclick`), no `$:` reactivity.
- **Tailwind** — use the existing zinc/emerald palette and sizing scale; don't introduce new design tokens without a reason.
- **Comments** — explain the *why*, not the *what*. Avoid decorative headers.
- **Prompts** — all AI prompts live in [src/lib/server/prompts.ts](src/lib/server/prompts.ts). Add new ones there, not inline in service files.
- **Database** — add new columns to both `schema.sqlite.ts` *and* `schema.pg.ts`. The two files are kept in shape-lockstep; the runtime shim ([schema.ts](src/lib/server/db/schema.ts)) expects both to export the same names.

---

## Pull request process

1. **Fork** the repository and create a branch off `main`:
   ```bash
   git checkout -b fix/short-description
   ```
2. **Make your change.** Keep PRs focused — one logical change per PR makes review much faster.
3. **Run checks** locally: `pnpm check` and `pnpm lint`.
4. **Write a clear commit message.** Use imperative mood (`Add X`, not `Added X`). Reference the issue number if one exists (`Fix #42: …`).
5. **Push and open a PR** against `main`. The PR template will prompt you for a summary and a test plan.
6. **Respond to review** — we aim to reply within a week. If a review stalls, feel free to ping.
7. **Squash on merge** is the default. Your commit history on the branch can be messy; the merged commit on `main` will be tidy.

### What makes a PR easy to accept

- The change has an issue that discussed the approach (not required for trivial fixes, but helps for anything with design tradeoffs).
- It doesn't break `pnpm check`.
- It does not add new dependencies without justification.
- It updates documentation if it changes user-visible behavior.
- It adds or updates AI prompts in `prompts.ts`, not inline.
- For schema changes: both SQLite and Postgres schemas are updated.

### What will likely be pushed back

- Sweeping refactors bundled with a feature or bugfix.
- New cloud-service dependencies (we aim to keep ResearchQ self-hostable).
- Changes that move data out of the user's local database.

---

## Code of Conduct

All project participants — contributors, maintainers, issue reporters, discussion posters — are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). If you see behavior that violates it, please email `ranatdasprangon@gmail.com`.
