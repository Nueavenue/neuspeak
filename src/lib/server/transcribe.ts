// src/lib/server/transcribe.ts
import { toFile } from 'openai';
import { openai, TRANSCRIBE_MODEL } from './openai';

// gpt-transcribe infers the codec from the filename extension, not just the
// content-type header — sending a mismatched extension (e.g. mp3 bytes named
// "*.webm") makes the API reject the file as corrupted.
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
	'audio/webm': 'webm',
	'audio/mp4': 'mp4',
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/m4a': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/ogg': 'ogg'
};

function extensionFor(contentType: string): string {
	const base = contentType.split(';')[0]?.trim().toLowerCase();
	return EXTENSION_BY_CONTENT_TYPE[base] ?? 'webm';
}

/**
 * Shared by /api/asr and /api/battle. gpt-transcribe accepts webm directly
 * (mp3/mp4/mpeg/mpga/m4a/wav/webm are all supported) — no client-side
 * re-encoding needed.
 * Docs: https://developers.openai.com/api/docs/guides/speech-to-text
 */
export async function transcribeAudio(buffer: ArrayBuffer, contentType: string): Promise<string> {
	const type = contentType || 'audio/webm';
	const file = await toFile(Buffer.from(buffer), `utterance.${extensionFor(type)}`, { type });

	const transcription = await openai.audio.transcriptions.create({
		file,
		model: TRANSCRIBE_MODEL
	});

	return transcription.text?.trim() ?? '';
}
