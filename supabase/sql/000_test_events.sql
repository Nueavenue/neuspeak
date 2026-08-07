-- Temporary connectivity-test table for NeuSpeak's Supabase migration.
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It backs the throwaway /api/test-db route and /test-db page, which
-- exist purely to prove the app can write to and read from Supabase before
-- any real (Account/Conversation/etc.) tables are wired up.
--
-- CLEANUP: once connectivity is proven, drop this table and delete
-- src/routes/api/test-db, src/routes/test-db, and this file. Don't reuse the
-- permissive policy below for real tables — it grants the anon key full
-- read/write with no ownership checks, which is only acceptable because this
-- table holds no user data.

create table if not exists public.test_events (
	id uuid primary key default gen_random_uuid(),
	message text not null,
	created_at timestamptz not null default now()
);

alter table public.test_events enable row level security;

drop policy if exists "test_events_anon_all (temporary)" on public.test_events;

create policy "test_events_anon_all (temporary)"
on public.test_events
for all
to anon
using (true)
with check (true);
