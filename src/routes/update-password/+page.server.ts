// src/routes/update-password/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * This page only makes sense right after clicking a password-reset email
 * link, which lands here via /auth/callback with a fresh recovery session
 * already set in cookies. No session ⇒ the link was invalid/expired/already
 * used ⇒ send them back to request a new one instead of showing a dead form.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		redirect(303, '/reset-password?expired=1');
	}
	return {};
};
