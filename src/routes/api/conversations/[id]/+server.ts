// src/routes/api/conversations/[id]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/errors';
import { getConversationWithMessages } from '$lib/server/conversations';
import { conversationDetailResponseSchema } from '$lib/schemas';

/**
 * GET — one conversation plus all of its messages, oldest first. Used by
 * the session detail view in src/routes/history/+page.svelte.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return apiError({
			route: 'GET /api/conversations/:id',
			status: 401,
			error: 'Please log in to see this conversation.',
			info: 'unauthenticated'
		});
	}

	const { data, error } = await getConversationWithMessages(locals.supabase, params.id);
	if (error) {
		return apiError({
			route: 'GET /api/conversations/:id',
			status: 502,
			error: 'Could not load this conversation — please try again.',
			info: 'db_error',
			reason: 'Supabase select failed',
			cause: error
		});
	}
	if (!data) {
		// Doesn't exist, or belongs to another user — Row Level Security makes
		// those look identical, and so does this 404 (never confirm it exists).
		return apiError({
			route: 'GET /api/conversations/:id',
			status: 404,
			error: 'Conversation not found.',
			info: 'not_found'
		});
	}

	return json(conversationDetailResponseSchema.parse(data));
};
