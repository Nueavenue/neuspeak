// src/routes/auth/callback/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Supabase Auth's email links (signup confirmation, password recovery) use
 * the PKCE flow: they redirect the browser here with a `?code=` param
 * rather than the session tokens directly. We exchange that code for a
 * real session — which writes it into cookies via locals.supabase (see
 * src/hooks.server.ts) — then forward the browser to wherever the flow
 * that started it wants to land (?next=..., e.g. /update-password for
 * password recovery, or / for a fresh signup).
 *
 * This exact URL — {origin}/auth/callback — must be added to Supabase's
 * Redirect URLs (Authentication → URL Configuration) for every environment
 * you use: http://localhost:5173/** for local dev, and
 * https://<your-vercel-domain>/** for production. See the "Authentication"
 * section of docs/api-architecture.md for the full checklist.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			redirect(303, next);
		}
		console.error('[auth/callback] exchangeCodeForSession failed', error.message);
	} else {
		const errorDescription = url.searchParams.get('error_description');
		if (errorDescription) {
			console.warn('[auth/callback] Supabase redirected with an error:', errorDescription);
		}
	}

	// No code, or the exchange failed — the link was invalid, already used,
	// or expired. Password-recovery links land back on /reset-password with
	// a clear "expired" notice; everything else (signup confirmation) goes
	// to /login with a generic error flag.
	redirect(
		303,
		next.startsWith('/update-password') ? '/reset-password?expired=1' : '/login?error=auth_callback'
	);
};
