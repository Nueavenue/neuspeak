// src/routes/signup/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Already-logged-in users get bounced straight past the signup form. */
export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (user) {
		redirect(303, '/');
	}
	return {};
};
