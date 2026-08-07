// src/lib/server/conversations.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation, Message } from '$lib/schemas';

/**
 * Conversation history data access, shared by the three
 * src/routes/api/conversations* routes. Every function here takes the
 * request-scoped `locals.supabase` client (see src/hooks.server.ts) — it's
 * bound to the caller's session cookie, so Row Level Security
 * (database/create_conversation_tables.sql) does the actual per-user
 * scoping. We never pass a user id into a WHERE clause ourselves for reads;
 * RLS is the source of truth for "is this mine?", not application code.
 */

interface ConversationRow {
	id: string;
	title: string | null;
	created_at: string;
	updated_at: string;
}

interface MessageRow {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	created_at: string;
}

function toConversation(row: ConversationRow): Conversation {
	return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

function toMessage(row: MessageRow): Message {
	return { id: row.id, role: row.role, content: row.content, createdAt: row.created_at };
}

const CONVERSATION_COLUMNS = 'id, title, created_at, updated_at';
const MESSAGE_COLUMNS = 'id, role, content, created_at';

/** All of the current user's conversations, most recently active first. */
export async function listConversations(
	supabase: SupabaseClient
): Promise<{ data: Conversation[] | null; error: string | null }> {
	const { data, error } = await supabase
		.from('conversations')
		.select(CONVERSATION_COLUMNS)
		.order('updated_at', { ascending: false });

	if (error) return { data: null, error: error.message };
	return { data: (data as ConversationRow[]).map(toConversation), error: null };
}

/** Starts a new session for `userId`, titled with the current local time. */
export async function createConversation(
	supabase: SupabaseClient,
	userId: string
): Promise<{ data: Conversation | null; error: string | null }> {
	const title = new Date().toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});

	const { data, error } = await supabase
		.from('conversations')
		.insert({ user_id: userId, title })
		.select(CONVERSATION_COLUMNS)
		.single();

	if (error) return { data: null, error: error.message };
	return { data: toConversation(data as ConversationRow), error: null };
}

/**
 * A single conversation plus its messages, oldest first. Returns
 * `{ data: null, error: null }` (not an error) if the id doesn't exist *or*
 * belongs to someone else — RLS makes those look identical on purpose, so
 * the route can turn that into a plain 404 without leaking which case it was.
 */
export async function getConversationWithMessages(
	supabase: SupabaseClient,
	conversationId: string
): Promise<{
	data: { conversation: Conversation; messages: Message[] } | null;
	error: string | null;
}> {
	const { data: conversationRow, error: conversationError } = await supabase
		.from('conversations')
		.select(CONVERSATION_COLUMNS)
		.eq('id', conversationId)
		.maybeSingle();

	if (conversationError) return { data: null, error: conversationError.message };
	if (!conversationRow) return { data: null, error: null };

	const { data: messageRows, error: messagesError } = await supabase
		.from('messages')
		.select(MESSAGE_COLUMNS)
		.eq('conversation_id', conversationId)
		.order('created_at', { ascending: true });

	if (messagesError) return { data: null, error: messagesError.message };

	return {
		data: {
			conversation: toConversation(conversationRow as ConversationRow),
			messages: (messageRows as MessageRow[]).map(toMessage)
		},
		error: null
	};
}

/**
 * Appends one message and bumps the parent conversation's `updated_at`.
 * The insert itself is what actually enforces ownership (RLS checks the
 * parent conversation's `user_id` — see the SQL file); the `updated_at`
 * bump is best-effort and never fails the request.
 */
export async function appendMessage(
	supabase: SupabaseClient,
	conversationId: string,
	role: Message['role'],
	content: string
): Promise<{ data: Message | null; error: string | null }> {
	const { data, error } = await supabase
		.from('messages')
		.insert({ conversation_id: conversationId, role, content })
		.select(MESSAGE_COLUMNS)
		.single();

	if (error) return { data: null, error: error.message };

	await supabase
		.from('conversations')
		.update({ updated_at: new Date().toISOString() })
		.eq('id', conversationId);

	return { data: toMessage(data as MessageRow), error: null };
}
