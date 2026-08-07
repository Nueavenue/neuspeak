// src/lib/auth/session.ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a `safeGetSession` function bound to a request-scoped Supabase
 * client (see src/hooks.server.ts). It re-validates the JWT with Supabase's
 * Auth server via `getUser()` instead of just trusting the (client-settable)
 * session cookie via `getSession()` — the official Supabase SSR guidance,
 * since a forged/stale cookie could otherwise look like a valid session.
 *
 * Used by src/hooks.server.ts (`event.locals.safeGetSession`) and read by
 * src/routes/+layout.server.ts and src/routes/+page.server.ts to decide
 * what to render/redirect.
 */
export function createSafeGetSession(supabase: SupabaseClient) {
	return async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await supabase.auth.getUser();
		if (error) {
			// Session cookie didn't match a valid, current user — treat as logged out.
			return { session: null, user: null };
		}

		return { session, user };
	};
}
