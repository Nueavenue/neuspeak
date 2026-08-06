import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB

function errorJson(message: string, status: number) {
	return json({ error: message }, { status });
}

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.startsWith('audio/')) {
		return errorJson('Expected an audio/* content-type (e.g. audio/webm)', 415);
	}

	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_AUDIO_BYTES) {
		return errorJson(`Audio too large (max ${MAX_AUDIO_BYTES / (1024 * 1024)}MB)`, 413);
	}

	let buffer: ArrayBuffer;
	try {
		buffer = await request.arrayBuffer();
	} catch {
		return errorJson('Could not read audio body', 400);
	}

	if (buffer.byteLength === 0) {
		return errorJson('Empty audio payload', 400);
	}

	if (buffer.byteLength > MAX_AUDIO_BYTES) {
		return errorJson(`Audio too large (max ${MAX_AUDIO_BYTES / (1024 * 1024)}MB)`, 413);
	}

	try {
		const startedAt = Date.now();

		// The key is read on the server only and is never sent to the client.
		// Not called yet — returning a stub transcript until this is wired.
		//
		// TODO(OpenAI transcription): POST the buffer as multipart/form-data (field "file")
		// to /v1/audio/transcriptions with model "gpt-transcribe", using env.OPENAI_API_KEY.
		// Guide: https://developers.openai.com/api/docs/guides/speech-to-text
		// Reference: https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
		// For live/streaming mic audio instead of a recorded blob, use a Realtime transcription
		// session (model "gpt-live-transcribe") per:
		// https://developers.openai.com/api/docs/guides/realtime
		void env.OPENAI_API_KEY;
		void env.TRANSCRIBE_MODEL;

		const durationMs = Date.now() - startedAt;

		return json({
			transcript: '[stub transcript — ASR not yet wired to OpenAI]',
			durationMs,
			confidence: 0
		});
	} catch (err) {
		console.error('POST /api/asr failed', err);
		return errorJson('Internal server error', 500);
	}
};
