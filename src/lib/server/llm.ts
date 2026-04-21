/**
 * Shared LLM model factory.
 *
 * Supports two providers (selected via LLM_PROVIDER):
 *
 *   gateway (default) — Vercel AI Gateway. Requires AI_GATEWAY_KEY.
 *                       Model ID uses the gateway's "<provider>/<model>"
 *                       format, e.g. "google/gemini-2.0-flash".
 *
 *   google            — Google AI Studio direct. Requires
 *                       GOOGLE_GENERATIVE_AI_API_KEY (the env var
 *                       @ai-sdk/google reads by default). Model ID is
 *                       the native form, e.g. "gemini-2.0-flash".
 *
 * The LLM env var picks the model (default: "google/gemini-2.0-flash").
 * Model IDs are normalized — you can write "google/gemini-2.0-flash"
 * or "gemini-2.0-flash" and the factory strips or adds the prefix to
 * match the provider.
 */
import { createGateway } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '$env/dynamic/private';

const provider = env.LLM_PROVIDER ?? 'gateway';
const modelId = env.LLM ?? 'google/gemini-2.0-flash';

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
