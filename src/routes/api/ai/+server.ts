import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { aiRequestSchema } from '$lib/schemas';
import { openai, CHAT_MODEL, COACH_VOICE, COACH_SYSTEM_PROMPT } from '$lib/server/openai';

// Generous cap for a JSON text payload; real audio goes through /api/asr instead.
const MAX_BODY_BYTES = 10_000;
const AUDIO_FORMAT = 'wav';

function errorJson(message: string, status: number) {
	return json({ error: message }, { status });
}

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		return errorJson('Expected content-type: application/json', 415);
	}

	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_BODY_BYTES) {
		return errorJson(`Request body too large (max ${MAX_BODY_BYTES} bytes)`, 413);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return errorJson('Invalid JSON body', 400);
	}

	const parsed = aiRequestSchema.safeParse(body);
	if (!parsed.success) {
		return errorJson(parsed.error.issues[0]?.message ?? 'Invalid request', 400);
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
			throw new Error('Empty reply from OpenAI');
		}

		const audioData = message?.audio?.data;

		return json({
			reply,
			...(audioData ? { audio: { data: audioData, format: AUDIO_FORMAT } } : {})
		});
	} catch (err) {
		console.error('POST /api/ai failed', err);
		return errorJson('Coach is unavailable right now — please try again.', 502);
	}
};
