import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transcribeAudio } from '$lib/server/transcribe';
import { scoreBattle } from '$lib/server/scoring';
import { prisma } from '$lib/server/db';
import { getAccountStats } from '$lib/server/leaderboard';
import { battleResponseSchema } from '$lib/schemas';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB, matches /api/asr

function errorJson(message: string, status: number) {
	return json({ error: message }, { status });
}

/**
 * One "voice battle" round: transcribe the clip, have an LLM judge grade it,
 * store the result, and return updated leaderboard stats for this account.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.startsWith('audio/')) {
		return errorJson('Expected an audio/* content-type (e.g. audio/webm)', 415);
	}

	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_AUDIO_BYTES) {
		return errorJson(`Audio too large (max ${MAX_AUDIO_BYTES / (1024 * 1024)}MB)`, 413);
	}

	// Client-reported recording length (VoiceRecorder tracks this); used only
	// as scoring context and a display value, not trusted for anything else.
	const recordedMs = Math.max(0, Math.round(Number(request.headers.get('x-recording-duration-ms') ?? '0')));

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
		const transcript = await transcribeAudio(buffer, contentType);
		if (!transcript) {
			return errorJson('Could not hear any speech — try recording again', 422);
		}

		const score = await scoreBattle(transcript, recordedMs);

		await prisma.battle.create({
			data: {
				accountId: locals.accountId,
				transcript,
				durationMs: recordedMs,
				points: score.overall,
				feedback: score.feedback
			}
		});

		const stats = await getAccountStats(locals.accountId);

		const body = battleResponseSchema.parse({
			transcript,
			score,
			points: score.overall,
			stats
		});

		return json(body);
	} catch (err) {
		console.error('POST /api/battle failed', err);
		return errorJson('Voice battle judging is unavailable right now — please try again.', 502);
	}
};
