import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transcribeAudio } from '$lib/server/transcribe';
import { apiError, upstreamError } from '$lib/server/errors';

const ROUTE = 'POST /api/asr';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB (OpenAI's own cap on this endpoint is 25MB)

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.startsWith('audio/')) {
		return apiError({
			route: ROUTE,
			status: 415,
			error: 'Expected an audio/* content-type (e.g. audio/webm)',
			info: 'invalid_content_type'
		});
	}

	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_AUDIO_BYTES) {
		return apiError({
			route: ROUTE,
			status: 413,
			error: `Audio too large (max ${MAX_AUDIO_BYTES / (1024 * 1024)}MB)`,
			info: 'payload_too_large'
		});
	}

	let buffer: ArrayBuffer;
	try {
		buffer = await request.arrayBuffer();
	} catch (err) {
		return apiError({
			route: ROUTE,
			status: 400,
			error: 'Could not read audio body',
			info: 'invalid_input',
			reason: 'Failed to read request body',
			cause: err
		});
	}

	if (buffer.byteLength === 0) {
		return apiError({
			route: ROUTE,
			status: 400,
			error: 'Empty audio payload',
			info: 'invalid_input'
		});
	}

	if (buffer.byteLength > MAX_AUDIO_BYTES) {
		return apiError({
			route: ROUTE,
			status: 413,
			error: `Audio too large (max ${MAX_AUDIO_BYTES / (1024 * 1024)}MB)`,
			info: 'payload_too_large'
		});
	}

	const startedAt = Date.now();

	try {
		const transcript = await transcribeAudio(buffer, contentType);
		if (!transcript) {
			return apiError({
				route: ROUTE,
				status: 422,
				error: 'Could not transcribe audio — try recording again',
				info: 'invalid_input',
				reason: 'OpenAI returned no speech/empty transcript'
			});
		}

		const durationMs = Date.now() - startedAt;

		// gpt-transcribe's default JSON response doesn't include a confidence score;
		// hardcode 1 until we opt into a model/response_format that reports one.
		return json({ transcript, durationMs, confidence: 1 });
	} catch (err) {
		return upstreamError(ROUTE, err);
	}
};
