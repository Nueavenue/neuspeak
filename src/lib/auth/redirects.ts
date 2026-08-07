// src/lib/auth/redirects.ts
import { env } from '$env/dynamic/public';

/**
 * The app's public base URL, used to build absolute redirect links for
 * Supabase Auth emails (signUp's `emailRedirectTo`, resetPasswordForEmail's
 * `redirectTo`). Prefers `PUBLIC_SITE_URL` if it's set (useful once you have
 * a stable production URL — see docs/api-architecture.md for the Supabase
 * dashboard config that must match it), and otherwise falls back to
 * `window.location.origin`, which is always correct for whichever
 * environment (local dev or the deployed URL) the user is currently on —
 * so this never breaks even if `PUBLIC_SITE_URL` is unset or stale.
 *
 * Browser-only — call this from .svelte files, not +server.ts routes.
 */
export function getSiteUrl(): string {
	const configured = env.PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
	if (configured) return configured;
	if (typeof window !== 'undefined') return window.location.origin;
	return '';
}

/** Builds the /auth/callback URL Supabase should redirect to after email confirmation or password recovery. */
export function getAuthCallbackUrl(next?: string): string {
	const base = `${getSiteUrl()}/auth/callback`;
	return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
