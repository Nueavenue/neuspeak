import { json } from '@sveltejs/kit';
import { toFile } from 'openai';
import type { RequestHandler } from './$types';
import { openai, TRANSCRIBE_MODEL } from '$lib/server/openai';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB (OpenAI's own cap on this endpoint is 25MB)

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

	const startedAt = Date.now();

	try {
		// Docs: https://developers.openai.com/api/docs/guides/speech-to-text
		// Reference: https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
		// gpt-transcribe accepts webm directly (mp3/mp4/mpeg/mpga/m4a/wav/webm are all supported).
		const file = await toFile(Buffer.from(buffer), 'utterance.webm', {
			type: contentType || 'audio/webm'
		});

		const transcription = await openai.audio.transcriptions.create({
			file,
			model: TRANSCRIBE_MODEL
		});

		const transcript = transcription.text?.trim();
		if (!transcript) {
			return errorJson('Could not transcribe audio — try recording again', 422);
		}

		const durationMs = Date.now() - startedAt;

		// gpt-transcribe's default JSON response doesn't include a confidence score;
		// hardcode 1 until we opt into a model/response_format that reports one.
		return json({ transcript, durationMs, confidence: 1 });
	} catch (err) {
		console.error('POST /api/asr failed', err);
		return errorJson('Transcription is unavailable right now — please try again.', 502);
	}
};
