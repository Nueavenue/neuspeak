// src/routes/api/conversations/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/errors';
import { listConversations, createConversation } from '$lib/server/conversations';
import { conversationsListResponseSchema, createConversationResponseSchema } from '$lib/schemas';

/** GET — the current user's conversation history, most recently active first. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return apiError({
			route: 'GET /api/conversations',
			status: 401,
			error: 'Please log in to see your conversation history.',
			info: 'unauthenticated'
		});
	}

	const { data, error } = await listConversations(locals.supabase);
	if (error) {
		return apiError({
			route: 'GET /api/conversations',
			status: 502,
			error: 'Could not load your conversation history — please try again.',
			info: 'db_error',
			reason: 'Supabase select failed',
			cause: error
		});
	}

	return json(conversationsListResponseSchema.parse({ conversations: data }));
};

/** POST — starts a new conversation session for the current user. */
export const POST: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return apiError({
			route: 'POST /api/conversations',
			status: 401,
			error: 'Please log in to start a conversation.',
			info: 'unauthenticated'
		});
	}

	const { data, error } = await createConversation(locals.supabase, user.id);
	if (error || !data) {
		return apiError({
			route: 'POST /api/conversations',
			status: 502,
			error: 'Could not start a new conversation — please try again.',
			info: 'db_error',
			reason: 'Supabase insert failed',
			cause: error
		});
	}

	return json(createConversationResponseSchema.parse({ conversation: data }), { status: 201 });
};
