// src/lib/server/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

// This module lives under src/lib/server/, so SvelteKit refuses to build it
// into any client-reachable bundle. PUBLIC_SUPABASE_URL/ANON_KEY are safe to
// expose (that's what the anon key + Row Level Security are for), but every
// query in this app still goes through our own server routes for now, the
// same pattern used for OpenAI — see src/lib/server/openai.ts.

const url = env.PUBLIC_SUPABASE_URL?.trim() || '';
const anon = env.PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

if (!url || !anon) {
	console.warn(
		'PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY are not set — Supabase calls will fail.'
	);
}

// Non-empty placeholders so `createClient` does not throw during SvelteKit
// postbuild analyse when Vercel env is not yet configured. Real values must
// still be set in Vercel → Environment Variables for Production.
export const supabase = createClient(
	url || 'https://placeholder.invalid',
	anon || 'public-anon-placeholder',
	{
		auth: {
			// No browser session to persist — every call here is server-to-server
			// using the anon key, scoped by Row Level Security policies per table.
			persistSession: false,
			autoRefreshToken: false
		}
	}
);
