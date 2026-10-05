import { describe, expect, it } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { extractJson, generateStructured, MalformedLlmOutputError } from './llm';

const schema = z.object({ items: z.array(z.string()) });

function modelReturning(text: string, finishReason: 'stop' | 'length' = 'stop') {
	return new MockLanguageModelV3({
		doGenerate: async () => ({
			content: [{ type: 'text', text }],
			finishReason: { unified: finishReason, raw: finishReason },
			usage: {
				inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
				outputTokens: { total: 1, text: 1, reasoning: 0 }
			},
			warnings: []
		})
	});
}

describe('generateStructured', () => {
	it('returns schema-valid JSON', async () => {
		await expect(
			generateStructured(schema, 'p', modelReturning('{"items":["a"]}'))
		).resolves.toEqual({ items: ['a'] });
	});

	it('falls back to lenient parsing when the model wraps JSON in a code fence', async () => {
		const text = 'Here you go:\n```json\n{"items":["a","b"]}\n```';
		await expect(generateStructured(schema, 'p', modelReturning(text))).resolves.toEqual({
			items: ['a', 'b']
		});
	});

	it('throws MalformedLlmOutputError for output that does not match the schema', async () => {
		await expect(
			generateStructured(schema, 'p', modelReturning('{"items": 3}'))
		).rejects.toBeInstanceOf(MalformedLlmOutputError);
	});

	it('throws MalformedLlmOutputError when the model stops early', async () => {
		await expect(
			generateStructured(schema, 'p', modelReturning('{"items": ["a"', 'length'))
		).rejects.toBeInstanceOf(MalformedLlmOutputError);
	});

	it('rethrows API errors unchanged so jobs can fail and be retried', async () => {
		const failing = new MockLanguageModelV3({
			doGenerate: async () => {
				throw new Error('network down');
			}
		});
		const err = await generateStructured(schema, 'p', failing).catch((e) => e);
		expect(err).not.toBeInstanceOf(MalformedLlmOutputError);
		expect(String(err.message)).toContain('network down');
	});
});

describe('extractJson', () => {
	it('handles plain JSON, fences and surrounding prose', () => {
		expect(extractJson('[1,2]')).toEqual([1, 2]);
		expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
		expect(extractJson('Sure! {"a": {"b": 2}} Hope that helps.')).toEqual({ a: { b: 2 } });
		expect(extractJson('no json here')).toBeUndefined();
	});
});
