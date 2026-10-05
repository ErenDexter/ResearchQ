/**
 * Shared LLM model factory.
 *
 * Supports two providers (selected via LLM_PROVIDER):
 *
 *   gateway (default) — Vercel AI Gateway. Requires AI_GATEWAY_KEY.
 *                       Model ID uses the gateway's "<provider>/<model>"
 *                       format, e.g. "google/gemini-3.1-flash-lite".
 *
 *   google            — Google AI Studio direct. Requires
 *                       GOOGLE_GENERATIVE_AI_API_KEY (the env var
 *                       @ai-sdk/google reads by default). Model ID is
 *                       the native form, e.g. "gemini-3.1-flash-lite".
 *
 * The LLM env var picks the model (default: "google/gemini-3.1-flash-lite").
 * Model IDs are normalized — you can write "google/gemini-3.1-flash-lite"
 * or "gemini-3.1-flash-lite" and the factory strips or adds the prefix to
 * match the provider.
 */
import {
	createGateway,
	generateText,
	NoObjectGeneratedError,
	NoOutputGeneratedError,
	Output,
	type LanguageModel
} from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { z } from 'zod';
import { env } from '$env/dynamic/private';

const provider = env.LLM_PROVIDER ?? 'gateway';
// Google retires older models (gemini-2.0-flash is gone; 2.5 is closed to new keys),
// so keep this default on a current, cheap model.
const modelId = env.LLM ?? 'google/gemini-3.1-flash-lite';

export function getModel() {
	if (provider === 'google') {
		if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
			throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set (LLM_PROVIDER=google)');
		}
		const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
		// @ai-sdk/google expects the native model ID without the "google/" prefix.
		const id = modelId.replace(/^google\//, '');
		return google(id);
	}

	if (provider !== 'gateway') {
		throw new Error(`Unknown LLM_PROVIDER "${provider}" — expected "gateway" or "google"`);
	}

	if (!env.AI_GATEWAY_KEY) {
		throw new Error('AI_GATEWAY_KEY is not set (LLM_PROVIDER=gateway)');
	}
	const gateway = createGateway({ apiKey: env.AI_GATEWAY_KEY });
	// The gateway routes by "<provider>/<model>" — add the prefix if omitted.
	const id = modelId.includes('/') ? modelId : `google/${modelId}`;
	return gateway(id);
}

/**
 * Thrown when the model answered but its output could not be turned into
 * data matching the schema (as opposed to API/network failures, which are
 * rethrown as-is so callers can fail and retry the job).
 */
export class MalformedLlmOutputError extends Error {
	constructor(
		message: string,
		readonly text: string | undefined
	) {
		super(message);
		this.name = 'MalformedLlmOutputError';
	}
}

/**
 * Generate a value matching `schema` using the provider's structured-output
 * (JSON schema) mode. If the provider ignores the response format and wraps
 * JSON in prose or code fences, the raw text is parsed leniently as a fallback.
 */
export async function generateStructured<T>(
	schema: z.ZodType<T>,
	prompt: string,
	model: LanguageModel = getModel()
): Promise<T> {
	try {
		const { output } = await generateText({
			model,
			prompt,
			output: Output.object({ schema })
		});
		return output;
	} catch (err) {
		if (NoOutputGeneratedError.isInstance(err)) {
			// The model stopped before finishing (e.g. hit the output token limit).
			throw new MalformedLlmOutputError('The model stopped before completing its answer.', undefined);
		}
		if (!NoObjectGeneratedError.isInstance(err)) throw err;
		const parsed = schema.safeParse(extractJson(err.text ?? ''));
		if (parsed.success) return parsed.data;
		console.error('LLM output did not match the expected schema:', err.text);
		throw new MalformedLlmOutputError('The model returned output in an unexpected format.', err.text);
	}
}

/** Best-effort extraction of a JSON value from model text (handles code fences and surrounding prose). */
export function extractJson(text: string): unknown {
	const unfenced = text
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '')
		.trim();
	try {
		return JSON.parse(unfenced);
	} catch {
		// fall through to the outermost {...} / [...] span
	}
	const start = unfenced.search(/[[{]/);
	const end = Math.max(unfenced.lastIndexOf('}'), unfenced.lastIndexOf(']'));
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(unfenced.slice(start, end + 1));
		} catch {
			// not JSON
		}
	}
	return undefined;
}
