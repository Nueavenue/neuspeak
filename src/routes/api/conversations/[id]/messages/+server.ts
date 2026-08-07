// src/routes/api/conversations/[id]/messages/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/errors';
import { appendMessage } from '$lib/server/conversations';
import { createMessageRequestSchema, createMessageResponseSchema } from '$lib/schemas';

/**
 * POST — appends one message (user/assistant/system) to a conversation.
 * Called from src/routes/+page.svelte for every completed turn of the live
 * Realtime session, and from the typed-message fallback. Fire-and-forget
 * from the client's point of view — a failure here logs to the debug panel
 * but never blocks the live conversation.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return apiError({
			route: 'POST /api/conversations/:id/messages',
			status: 401,
			error: 'Please log in to save messages.',
			info: 'unauthenticated'
		});
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return apiError({
			route: 'POST /api/conversations/:id/messages',
			status: 400,
			error: 'Expected a JSON body.',
			info: 'invalid_input'
		});
	}

	const parsed = createMessageRequestSchema.safeParse(body);
	if (!parsed.success) {
		return apiError({
			route: 'POST /api/conversations/:id/messages',
			status: 400,
			error: parsed.error.issues[0]?.message ?? 'Invalid message — expected { role, content }.',
			info: 'invalid_input'
		});
	}

	const { data, error } = await appendMessage(
		locals.supabase,
		params.id,
		parsed.data.role,
		parsed.data.content
	);
	if (error || !data) {
		// Row Level Security rejects inserts into a conversation you don't
		// own — that surfaces here as a generic insert error, not a 403, so a
		// caller can't use this endpoint to probe which conversation ids exist.
		return apiError({
			route: 'POST /api/conversations/:id/messages',
			status: 502,
			error: 'Could not save this message.',
			info: 'db_error',
			reason: 'Supabase insert failed (or conversation is not yours)',
			cause: error
		});
	}

	return json(createMessageResponseSchema.parse({ message: data }), { status: 201 });
};
