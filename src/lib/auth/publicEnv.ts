/**
 * Public env for browser + hooks.
 * Uses `$env/dynamic/public` so Vercel builds do not fail with MISSING_EXPORT
 * when PUBLIC_* are not yet set at compile time (static/public requires them).
 * Runtime still needs real values in Vercel → Settings → Environment Variables.
 */
import { env } from '$env/dynamic/public';

export function publicSupabaseUrl(): string {
	return env.PUBLIC_SUPABASE_URL?.trim() || '';
}

export function publicSupabaseAnonKey(): string {
	return env.PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
}
