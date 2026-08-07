import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

// This module lives under src/lib/server/, so SvelteKit refuses to build it
// into any client-reachable bundle — importing it from a .svelte file is a
// build-time error, not just a convention we have to remember.

if (!env.OPENAI_API_KEY) {
	console.warn('OPENAI_API_KEY is not set — OpenAI calls will fail until it is configured.');
}

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// /api/ai generates spoken replies, which the current Responses API docs say
// isn't supported yet ("Responses API docs currently describe text and image
// inputs with text outputs... use Chat Completions with an audio-capable
// model" — see https://developers.openai.com/api/docs/guides/audio).
// So MODEL_NAME must be an audio-capable Chat Completions model, not a plain
// text model and not a Realtime-only model like gpt-4o-realtime-preview.
export const CHAT_MODEL = env.MODEL_NAME || 'gpt-audio-1.5';
export const TRANSCRIBE_MODEL = env.TRANSCRIBE_MODEL || 'gpt-transcribe';
export const COACH_VOICE = env.COACH_VOICE || 'alloy';

// Live, hands-free speech-to-speech conversation (see /api/realtime/session
// and RealtimeVoice.svelte) uses the Realtime API over WebRTC instead of the
// request/response Chat Completions flow above.
export const REALTIME_MODEL = env.REALTIME_MODEL || 'gpt-realtime-2.1';
export const REALTIME_VOICE = env.REALTIME_VOICE || 'marin';

// Voice battle scoring (src/lib/server/scoring.ts) is a cheap, fast, plain
// text judging task — no audio in or out — so it uses a lightweight text
// model rather than CHAT_MODEL (which must be audio-capable) or a Realtime
// model.
export const JUDGE_MODEL = env.JUDGE_MODEL || 'gpt-4o-mini';

export const COACH_SYSTEM_PROMPT = `You are NeuSpeak, a warm, encouraging English speaking coach for non-native speakers.
Reply to what the learner said in natural, conversational English, like a friendly native-speaking tutor.
Keep replies short (1-3 sentences) so the conversation stays fast-paced and speech-focused.
If the learner made a grammar or word-choice mistake, gently model the correct phrasing inside your reply
instead of lecturing about grammar rules. Always end with a short follow-up question to keep them talking.`;

/**
 * The Responses API SDK exposes a convenience `output_text` field, but we fall
 * back to walking `output` manually in case that field is ever missing.
 */
export function extractResponseText(response: unknown): string {
	const res = response as {
		output_text?: unknown;
		output?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }>;
	};

	if (typeof res.output_text === 'string' && res.output_text.trim().length > 0) {
		return res.output_text.trim();
	}

	for (const item of res.output ?? []) {
		if (item?.type !== 'message') continue;
		for (const part of item.content ?? []) {
			if (part?.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
				return part.text.trim();
			}
		}
	}

	return '';
}
