// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

/**
 * Runs on every request. Exposes the validated session/user (from
 * event.locals.safeGetSession, set in src/hooks.server.ts) to every page's
 * `data`, so the header nav in +layout.svelte can show Login/Signup vs
 * Logout without each route re-checking auth itself. Route-level *access
 * control* (redirecting logged-out users away from the chatbot) lives in
 * src/routes/+page.server.ts, not here — this file never redirects.
 */
export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('supabase:auth');
	const { session, user } = await locals.safeGetSession();
	return { session, user };
};
