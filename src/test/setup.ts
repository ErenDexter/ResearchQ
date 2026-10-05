/**
 * Vitest setup: every test file gets its own throwaway SQLite database, and
 * SvelteKit's `$env/dynamic/private` reads straight from process.env.
 */
import { vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DB_DIALECT = 'sqlite';
process.env.DATABASE_URL = join(mkdtempSync(join(tmpdir(), 'researchq-test-')), 'test.db');

vi.mock('$env/dynamic/private', () => ({ env: process.env }));
