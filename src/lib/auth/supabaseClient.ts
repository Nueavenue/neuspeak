// src/lib/auth/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';
import { publicSupabaseAnonKey, publicSupabaseUrl } from '$lib/auth/publicEnv';

/**
 * Browser-side Supabase client for auth calls that must run in the browser
 * (signInWithPassword, signUp, resetPasswordForEmail, updateUser, signOut).
 * Built with @supabase/ssr's createBrowserClient so the session is written
 * to cookies (not just localStorage) — that's what lets our server routes
 * (src/hooks.server.ts, +layout.server.ts, +page.server.ts) see the same
 * session via src/lib/auth/session.ts.
 *
 * This is distinct from src/lib/server/supabase.ts, which is server-only
 * and used for data queries with the anon key — that one is never imported
 * here, and this one is never imported from a +server.ts route.
 */
const url = publicSupabaseUrl() || 'https://placeholder.invalid';
const anon = publicSupabaseAnonKey() || 'public-anon-placeholder';

export const supabase = createBrowserClient(url, anon);
