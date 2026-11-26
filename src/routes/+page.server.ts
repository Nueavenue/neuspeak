// src/routes/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Guards the main chatbot page: NeuSpeak used to be an open demo where
 * anyone could land here and start talking. Now that conversations will be
 * saved per-user (Supabase Auth), an anonymous visitor gets bounced to
 * /login instead of ever reaching the mic/chat UI.
 *
 * `session`/`user` here are already validated by locals.safeGetSession()
 * (src/lib/auth/session.ts, called in src/hooks.server.ts) — a forged
 * cookie won't pass this check.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();

	// os.neu Seat Face embeds NeuSpeak with ?embed=osneu — allow guest coach
	// without bouncing to /login (Realtime session still needs OPENAI_API_KEY).
	const osneuEmbed = url.searchParams.get('embed') === 'osneu';

	if (!user && !osneuEmbed) {
		const redirectTo = encodeURIComponent(url.pathname + url.search);
		redirect(303, `/login?redirectTo=${redirectTo}`);
	}

	return { user };
};
