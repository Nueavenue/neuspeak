// src/routes/login/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Already-logged-in users get bounced straight past the login form. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (user) {
		redirect(303, url.searchParams.get('redirectTo') || '/');
	}
	return {};
};
