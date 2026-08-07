// src/routes/api/realtime/session/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { REALTIME_MODEL, REALTIME_VOICE, COACH_SYSTEM_PROMPT } from '$lib/server/openai';
import { realtimeSessionResponseSchema } from '$lib/schemas';

function errorJson(message: string, status: number) {
	return json({ error: message }, { status });
}

/**
 * Mints a short-lived ephemeral client secret the browser can use to open a
 * WebRTC connection directly to OpenAI's Realtime API. OPENAI_API_KEY itself
 * never leaves this server — only the ephemeral value (which expires quickly
 * and is scoped to a single Realtime session) is returned to the browser.
 *
 * Docs: https://developers.openai.com/api/docs/guides/realtime-webrtc
 */
export const GET: RequestHandler = async () => {
	if (!env.OPENAI_API_KEY) {
		return errorJson('Server is not configured with an OpenAI API key', 500);
	}

	try {
		const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				session: {
					type: 'realtime',
					model: REALTIME_MODEL,
					instructions: COACH_SYSTEM_PROMPT,
					audio: {
						input: {
							transcription: { model: 'gpt-4o-mini-transcribe' },
							turn_detection: { type: 'semantic_vad' }
						},
						output: {
							voice: REALTIME_VOICE
						}
					}
				}
			})
		});

		const data = await response.json();

		if (!response.ok || typeof data?.value !== 'string') {
			console.error('POST /v1/realtime/client_secrets failed', data);
			return errorJson('Failed to start realtime session', 502);
		}

		const body = realtimeSessionResponseSchema.parse({
			value: data.value,
			expiresAt: data.expires_at ?? null
		});
		return json(body);
	} catch (err) {
		console.error('GET /api/realtime/session failed', err);
		return errorJson('Failed to start realtime session', 502);
	}
};
