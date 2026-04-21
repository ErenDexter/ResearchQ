# Configuration

All configuration lives in `.env`. This document explains every variable, the tradeoffs between choices, and common patterns.

The authoritative machine-readable reference is [.env.example](../.env.example) — if this document and that file ever disagree, the `.env.example` wins.

---

## Quick reference

| Variable | Purpose | Default | Required? |
|---|---|---|---|
| `DB_DIALECT` | `sqlite` or `postgres` | `sqlite` | No |
| `DATABASE_URL` | SQLite file path **or** Postgres connection string | `./data/researchq.db` | No |
| `LLM_PROVIDER` | `gateway` or `google` | `gateway` | No |
| `LLM` | Gemini model identifier | `google/gemini-2.0-flash` | No |
| `AI_GATEWAY_KEY` | Vercel AI Gateway API key | — | Yes (gateway mode) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio API key | — | Yes (google mode) |
| `OPENALEX_EMAIL` | Your email for the OpenAlex "polite pool" | — | Recommended |

---

## Database

### `DB_DIALECT`

Selects the database backend.

- `sqlite` (default) — local file, zero configuration, perfect for single-user self-hosted use. All data stays on the user's disk.
- `postgres` — Postgres 14+, useful for shared deployments where multiple people need to collaborate on the same review.

Changing the dialect mid-project requires a manual data migration — it's not automatic. Pick one when you start a project.

### `DATABASE_URL`

Meaning depends on `DB_DIALECT`.

**SQLite mode:**
- A filesystem path. Relative paths are resolved against `process.cwd()`.
- Default when unset: `./data/researchq.db`. The `data/` directory is created automatically.
- Example: `./data/my-review.db`, `/home/me/reviews/project.db`, `C:\Users\me\researchq.db`.

**Postgres mode:**
- A standard Postgres connection string.
- Example: `postgresql://user:password@localhost:5432/researchq?sslmode=require`.
- Must be reachable from the server — test with `psql "$DATABASE_URL"` first.

### Applying the schema

- SQLite: `pnpm db:push`
- Postgres: `pnpm db:push:pg`

Both are safe to re-run. `drizzle-kit` computes a diff between your schema files and the live database and applies only the differences.

### Changing schema during development

1. Edit **both** [schema.sqlite.ts](../src/lib/server/db/schema.sqlite.ts) and [schema.pg.ts](../src/lib/server/db/schema.pg.ts) — keep them in lockstep.
2. Run `pnpm db:push` (or `db:push:pg`).
3. Drizzle may prompt for confirmation on destructive changes (drops, renames) — answer deliberately.

---

## LLM

ResearchQ uses the Vercel AI SDK (`ai` package) to reach a Gemini model. Two providers are supported; pick whichever is easier to get a key for.

### `LLM_PROVIDER`

- `gateway` (default) — **Vercel AI Gateway**. A proxy in front of Gemini (and several other providers). Free tier available. Sign up at https://vercel.com/ai-gateway.
- `google` — **Google AI Studio direct**. A native Google API key. Sign up at https://aistudio.google.com/apikey.

**Which should I use?**

| Use `gateway` if... | Use `google` if... |
|---|---|
| You don't already have a Google account set up for AI Studio | You already have an AI Studio key |
| You want one key that also works for OpenAI/Anthropic models via Vercel | You want to avoid an extra proxy hop |
| You want Vercel's free monthly credit | You want maximum rate limits (AI Studio's tier is generous) |

Both produce equivalent results for ResearchQ's workloads.

### `LLM`

The Gemini model identifier. The `google/` prefix is optional — the tool adds or strips it to match the active provider.

Reasonable choices:

- `gemini-2.0-flash` (default) — fast, cheap, good enough for screening and extraction.
- `gemini-2.5-flash` — newer; higher quality on complex prompts, still fast.
- `gemini-2.5-pro` — highest quality, slower, more expensive; use when screening precision really matters.
- `gemini-1.5-flash`, `gemini-1.5-pro` — older but still fully supported.

**Recommendation:** start with `gemini-2.0-flash` for everything. Once you have some output to evaluate, try `gemini-2.5-pro` on relevance screening if the AI is making too many wrong calls.

You can change the model any time — set it, restart the server, and subsequent AI calls use the new model. Past extractions are not re-run automatically.

### `AI_GATEWAY_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`

Credentials for the chosen provider. Only the one for your active `LLM_PROVIDER` is required. Keep these out of version control — they're in `.gitignore` by default.

---

## OpenAlex

### `OPENALEX_EMAIL`

Optional but recommended. OpenAlex operates two request pools:

- **Anonymous pool** — lower rate limits, slower under load.
- **Polite pool** — higher rate limits, faster; you opt in by sending your email in the `mailto` query parameter or `User-Agent` header.

Set `OPENALEX_EMAIL=you@example.com`. OpenAlex uses it only to contact you if your traffic pattern looks like abuse — they don't spam, newsletter, or sell it. See their [rate-limit docs](https://docs.openalex.org/how-to-use-the-api/rate-limits-and-authentication).

---

## Common configurations

### Local, single-user, default stack

```env
LLM_PROVIDER=gateway
AI_GATEWAY_KEY=vck_...
OPENALEX_EMAIL=you@example.com
```

That's it. SQLite + the default model + OpenAlex polite pool — works out of the box.

### Local, single-user, direct Google

```env
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
LLM=gemini-2.5-flash
OPENALEX_EMAIL=you@example.com
```

### Shared Postgres deployment

```env
DB_DIALECT=postgres
DATABASE_URL=postgresql://user:password@db.example.com:5432/researchq?sslmode=require
LLM_PROVIDER=gateway
AI_GATEWAY_KEY=vck_...
OPENALEX_EMAIL=team@example.com
```

Behind a reverse proxy, terminate TLS at the proxy and keep the Node process on localhost. The tool does not implement authentication — if you're deploying publicly, put it behind an auth layer (oauth2-proxy, Caddy with basic auth, institutional SSO, etc.).

### Higher precision at higher cost

```env
LLM=gemini-2.5-pro
```

Use when you're doing a critical review and want to trade speed for screening precision. A 500-paper topic search goes from ~40 seconds to a few minutes, and AI call cost rises accordingly.

---

## What is NOT configurable via env

Some things live in code, not environment variables:

- **Prompts** — in [src/lib/server/prompts.ts](../src/lib/server/prompts.ts). Edit the file if you want to tune them.
- **Methodologies and phases** — in [src/lib/server/db/seed-methodologies.ts](../src/lib/server/db/seed-methodologies.ts).
- **Output-type registry** — in [src/lib/server/literature-review.ts](../src/lib/server/literature-review.ts).
- **Project-specific relevance definition, criteria, dimensions, and keywords** — set per-project in the UI and stored in the database.
