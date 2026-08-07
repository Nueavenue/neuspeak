-- database/create_conversation_tables.sql
--
-- Conversation history for NeuSpeak: one row per chat session
-- (`conversations`) and one row per message within it (`messages`).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Ownership: `user_id` references `auth.users(id)` — Supabase Auth's own
-- user table. We deliberately do NOT create a separate `public.users` /
-- profiles table here; there's no reason to duplicate identity Supabase
-- Auth already owns, and this project has no other org/schema to collide
-- with (the only other table so far is the unrelated, throwaway
-- `public.test_events` from supabase/sql/000_test_events.sql).
--
-- Row Level Security (RLS) is enabled on both tables so a user can only
-- ever read/write their own data — enforced by Postgres itself via the
-- policies below, not just by app code filtering queries.

create table if not exists public.conversations (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	-- Nullable: the API defaults it to a timestamp label at creation time
	-- (see src/routes/api/conversations/+server.ts); left free-form here in
	-- case a future feature wants to rename sessions.
	title text,
	created_at timestamptz not null default now(),
	-- Bumped whenever a message is added (see the messages insert policy's
	-- companion update in +server.ts) so the history list can sort by
	-- "most recently active" instead of only creation time.
	updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_updated_at_idx on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
	id uuid primary key default gen_random_uuid(),
	conversation_id uuid not null references public.conversations (id) on delete cascade,
	role text not null check (role in ('user', 'assistant', 'system')),
	content text not null,
	created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own"
on public.conversations
for select
to authenticated
using (auth.uid () = user_id);

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own"
on public.conversations
for insert
to authenticated
with check (auth.uid () = user_id);

drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own"
on public.conversations
for update
to authenticated
using (auth.uid () = user_id)
with check (auth.uid () = user_id);

drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own"
on public.conversations
for delete
to authenticated
using (auth.uid () = user_id);

-- `messages` has no user_id column of its own — ownership is derived from
-- its parent conversation, so every policy checks that via a subquery.
-- Only select/insert are needed: chat history is an append-only log, so
-- nobody (not even the owner) gets update/delete policies on messages.
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
on public.messages
for select
to authenticated
using (
	exists (
		select 1
		from public.conversations c
		where c.id = messages.conversation_id
		and c.user_id = auth.uid ()
	)
);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages
for insert
to authenticated
with check (
	exists (
		select 1
		from public.conversations c
		where c.id = messages.conversation_id
		and c.user_id = auth.uid ()
	)
);
