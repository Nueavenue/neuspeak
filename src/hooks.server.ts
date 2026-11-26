// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';
import { dev } from '$app/environment';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createSafeGetSession } from '$lib/auth/session';

const ACCOUNT_COOKIE = 'ns_account';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Builds a request-scoped Supabase client wired to this request's cookies
 * (event.locals.supabase) and a safeGetSession() helper (event.locals),
 * both consumed by src/routes/+layout.server.ts and src/routes/+page.server.ts
 * to decide what to render and whether to redirect to /login.
 */
const supabaseAuthHandle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	event.locals.safeGetSession = createSafeGetSession(event.locals.supabase);

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			// Supabase's own client reads these on the response; everything else stays private.
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

/**
 * TEMPORARY: no Prisma database on Vercel yet.
 *
 * Assigns every visitor an anonymous ID via an httpOnly cookie. This is
 * unrelated to Supabase Auth above — it's what still powers the /practice
 * voice-battle demo (src/routes/api/battle, /api/me) until that's migrated
 * to real accounts. Runs independently via `sequence()` below.
 */
const anonymousAccountHandle: Handle = async ({ event, resolve }) => {
	let id = event.cookies.get(ACCOUNT_COOKIE);

	if (!id) {
		id = crypto.randomUUID();
		event.cookies.set(ACCOUNT_COOKIE, id, {
			path: '/',
			maxAge: ONE_YEAR_SECONDS,
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev
		});
	}

	event.locals.accountId = id;
	event.locals.accountDisplayId = id; // stub: same as id for now

	return resolve(event);
};

/**
 * Allow os.neu Seat Face (and local Vite) to embed NeuSpeak as an in-seat
 * workspace iframe — not a popup. Does not widen cookie/auth scope.
 */
const embedForOsNeuHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set(
		'Content-Security-Policy',
		[
			"frame-ancestors 'self'",
			'http://127.0.0.1:*',
			'http://localhost:*',
			'https://os.neuavenue.com',
			'https://*.neuavenue.com',
			'app://*',
			'file:'
		].join(' ')
	);
	response.headers.delete('X-Frame-Options');
	return response;
};

export const handle: Handle = sequence(
	supabaseAuthHandle,
	anonymousAccountHandle,
	embedForOsNeuHandle
);
