# Installation

This guide walks through a fresh install of ResearchQ on macOS, Linux, and Windows. Most users should follow the **Default: local SQLite** path — it's zero-configuration and keeps all your data on your own machine.

---

## Requirements

| Component | Minimum | Notes |
|---|---|---|
| Node.js | ≥ 20 (LTS) | Check with `node -v` |
| pnpm | ≥ 9 | Or use `npm` / `yarn` with equivalent commands |
| Build toolchain | C/C++ compiler + Python 3 | Needed for `better-sqlite3` native compilation |
| LLM API key | One of: Vercel AI Gateway OR Google AI Studio | Free tiers of both are sufficient for evaluation |
| Disk space | ~300 MB for dependencies, plus your paper data | SQLite database grows with your corpus |

### Build toolchain by OS

- **macOS:** `xcode-select --install`
- **Debian/Ubuntu:** `sudo apt install build-essential python3`
- **Fedora/RHEL:** `sudo dnf group install "Development Tools"` and `sudo dnf install python3`
- **Windows:** Install Visual Studio Build Tools (the "Desktop development with C++" workload) or run `npm install --global windows-build-tools` in an elevated PowerShell.

---

## Default: local SQLite (recommended)

### 1. Clone and install

```bash
git clone https://github.com/ErenDexter/ResearchQ.git
cd ResearchQ
pnpm install
```

If `pnpm install` fails on the `better-sqlite3` step, see [Troubleshooting](#troubleshooting).

### 2. Configure

```bash
cp .env.example .env
```

Open `.env` and set **one** of the LLM keys:

```env
# Option A — use the Vercel AI Gateway (default, has a free tier)
LLM_PROVIDER=gateway
AI_GATEWAY_KEY=vck_...

# Option B — use Google AI Studio directly
LLM_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

- Get a Vercel AI Gateway key: https://vercel.com/ai-gateway
- Get a Google AI Studio key: https://aistudio.google.com/apikey

Optional but recommended:

```env
OPENALEX_EMAIL=you@example.com   # puts you in OpenAlex's faster polite-pool
```

Full env-var reference: [configuration.md](configuration.md).

### 3. Create the database

```bash
pnpm db:push
```

This creates `./data/researchq.db` and writes the schema. Safe to re-run.

### 4. Start the dev server

```bash
pnpm dev
```

Open http://localhost:5173. You'll be redirected to `/projects/new` because the database is empty. See [quickstart.md](quickstart.md) for what to do from there.

---

## Alternative: Postgres

ResearchQ can also run against a Postgres database — useful if you want to deploy it as a shared service for a research group.

### 1. Provision a Postgres instance

Anything that speaks Postgres 14+ works: local `postgres`, Docker, Neon, Supabase, a managed service at your institution, etc.

### 2. Configure

```env
DB_DIALECT=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
```

### 3. Apply the schema

```bash
pnpm db:push:pg
```

### 4. Start the server

```bash
pnpm dev
```

The runtime and CLI tooling pick up `DB_DIALECT=postgres` automatically.

---

## Production build

```bash
pnpm build
pnpm preview    # quick local test
```

The output is a Node.js server (via `@sveltejs/adapter-node`). Deploy the `build/` directory behind any Node-capable host (a VM, a container, Digital Ocean App Platform, Fly.io, etc.). Make sure the `.env` values are set on the host.

---

## Troubleshooting

### `better-sqlite3` fails to install

The `better-sqlite3` package builds a native module on install. If that fails:

- **Windows:** Install the Visual Studio Build Tools with the C++ workload. Close and reopen your terminal so the updated `PATH` is picked up. Re-run `pnpm install`.
- **macOS / Linux:** Ensure a C++ toolchain and Python 3 are available (see [Build toolchain by OS](#build-toolchain-by-os)). If you see a Python 2 error, ensure `python3` resolves.
- **All platforms:** Delete `node_modules` and `pnpm-lock.yaml`, then retry `pnpm install`.

### "DATABASE_URL is not set (postgres mode)"

You set `DB_DIALECT=postgres` but didn't set `DATABASE_URL`. Either set both, or unset `DB_DIALECT` to fall back to SQLite.

### "AI_GATEWAY_KEY is not set (LLM_PROVIDER=gateway)" / "GOOGLE_GENERATIVE_AI_API_KEY is not set (LLM_PROVIDER=google)"

You haven't provided the key for the provider you selected. See step 2 of the default install.

### The page loads forever on the project creation screen

The AI setup call can take 10–30 seconds depending on your LLM provider and region. Open the browser dev tools network tab — a stuck request to `/api/projects/.../setup` usually means the LLM call is waiting on a response. If it eventually fails, check the server logs in the terminal where you ran `pnpm dev`.

### I want to start over from scratch

Delete the database file and re-push:

```bash
rm -rf data/                  # or: del data\ on Windows
pnpm db:push
pnpm dev
```

This wipes all projects, papers, and search history.

### More help

- Check [faq.md](faq.md) for commonly asked questions.
- Search [existing issues](../../../issues).
- Open a [new issue](../../../issues/new?template=bug_report.md) or a [discussion](../../../discussions).
