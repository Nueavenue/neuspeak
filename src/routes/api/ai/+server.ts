// src/routes/api/ai/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiRequestSchema } from '$lib/schemas';
import { openai, CHAT_MODEL, COACH_VOICE, COACH_SYSTEM_PROMPT } from '$lib/server/openai';
import { apiError, upstreamError } from '$lib/server/errors';

const ROUTE = 'POST /api/ai';
// Generous cap for a JSON text payload; real audio goes through /api/asr instead.
const MAX_BODY_BYTES = 10_000;
const AUDIO_FORMAT = 'wav';

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		return apiError({
			route: ROUTE,
			status: 415,
			error: 'Expected content-type: application/json',
			info: 'invalid_content_type'
		});
	}

	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_BODY_BYTES) {
		return apiError({
			route: ROUTE,
			status: 413,
			error: `Request body too large (max ${MAX_BODY_BYTES} bytes)`,
			info: 'payload_too_large'
		});
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch (err) {
		return apiError({
			route: ROUTE,
			status: 400,
			error: 'Invalid JSON body',
			info: 'invalid_input',
			reason: 'Body failed to parse as JSON',
			cause: err
		});
	}

	const parsed = aiRequestSchema.safeParse(body);
	if (!parsed.success) {
		return apiError({
			route: ROUTE,
			status: 400,
			error: parsed.error.issues[0]?.message ?? 'Invalid request',
			info: 'invalid_input',
			reason: 'Zod validation failed'
		});
	}

	try {
		// Docs: https://developers.openai.com/api/docs/guides/audio
		// The Responses API is text/image-only right now, so a spoken reply
		// requires Chat Completions with an audio-capable model (gpt-audio-1.5)
		// and modalities: ["text", "audio"].
		const completion = await openai.chat.completions.create({
			model: CHAT_MODEL,
			modalities: ['text', 'audio'],
			audio: { voice: COACH_VOICE, format: AUDIO_FORMAT },
			store: true,
			messages: [
				{ role: 'system', content: COACH_SYSTEM_PROMPT },
				{ role: 'user', content: parsed.data.message }
			]
		});

		const message = completion.choices[0]?.message;
		// When audio output is requested, the spoken transcript lands on
		// message.audio.transcript; message.content is often empty/null.
		const reply = (message?.audio?.transcript ?? message?.content ?? '').trim();

		if (!reply) {
			return apiError({
				route: ROUTE,
				status: 502,
				error: 'Coach is unavailable right now — please try again.',
				info: 'upstream_error',
				reason: 'OpenAI returned an empty reply'
			});
		}

		const audioData = message?.audio?.data;

		return json({
			reply,
			...(audioData ? { audio: { data: audioData, format: AUDIO_FORMAT } } : {})
		});
	} catch (err) {
		return upstreamError(ROUTE, err);
	}
};
