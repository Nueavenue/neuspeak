import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { aiRequestSchema } from '$lib/schemas';

// Generous cap for a JSON text payload; real audio goes through /api/asr instead.
const MAX_BODY_BYTES = 10_000;

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
		// The key is read on the server only and is never sent to the client.
		// Not called yet — Phase A is a validated proxy skeleton.
		//
		// TODO(OpenAI Chat/Responses): call OpenAI here using env.OPENAI_API_KEY + env.MODEL_NAME.
		// Docs: https://developers.openai.com/api/docs/guides/text-generation
		void env.OPENAI_API_KEY;
		void env.MODEL_NAME;

		const reply = `Coach: ${parsed.data.message}`;
		return json({ reply });
	} catch (err) {
		console.error('POST /api/ai failed', err);
		return errorJson('Internal server error', 500);
	}
};
