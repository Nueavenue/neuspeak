// import type { Handle } from '@sveltejs/kit';
// import { dev } from '$app/environment';
// //import { prisma } from '$lib/server/db';
// //import { generateDisplayId } from '$lib/server/account';

// const ACCOUNT_COOKIE = 'ns_account';
// const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// /**
//  * Assigns every visitor an anonymous Account (no login) via a signed,
//  * httpOnly cookie holding the internal Account.id. This is what powers
//  * voice battle history + the leaderboard across visits from the same
//  * browser. The cookie is never readable/writable from client JS, so a
//  * learner can't just edit localStorage to inflate their score.
//  */
// export const handle: Handle = async ({ event, resolve }) => {
// 	const existingId = event.cookies.get(ACCOUNT_COOKIE);
// 	let account = existingId ? await prisma.account.findUnique({ where: { id: existingId } }) : null;

// 	if (!account) {
// 		let displayId = generateDisplayId();
// 		for (let attempt = 0; attempt < 5; attempt++) {
// 			const clash = await prisma.account.findUnique({ where: { displayId } });
// 			if (!clash) break;
// 			displayId = generateDisplayId();
// 		}

// 		account = await prisma.account.create({ data: { displayId } });
// 		event.cookies.set(ACCOUNT_COOKIE, account.id, {
// 			path: '/',
// 			maxAge: ONE_YEAR_SECONDS,
// 			httpOnly: true,
// 			sameSite: 'lax',
// 			secure: !dev
// 		});
// 	}

// 	event.locals.accountId = account.id;
// 	event.locals.accountDisplayId = account.displayId;

// 	return resolve(event);
// };

import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

const ACCOUNT_COOKIE = 'ns_account';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * TEMPORARY: no database
 *
 * We assign each visitor an anonymous ID via an httpOnly cookie.
 * This avoids any Prisma/DB calls on Vercel until we configure a real DB.
 */
export const handle: Handle = async ({ event, resolve }) => {
	let id = event.cookies.get(ACCOUNT_COOKIE);

	// If no cookie yet, generate a random ID and set it
	if (!id) {
		// crypto.randomUUID() is available in Node 18+ and SvelteKit
		id = crypto.randomUUID();

		event.cookies.set(ACCOUNT_COOKIE, id, {
			path: '/',
			maxAge: ONE_YEAR_SECONDS,
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev
		});
	}

	// Provide locals so the rest of the app can still read a stable ID
	event.locals.accountId = id;
	event.locals.accountDisplayId = id; // stub: same as id for now

	return resolve(event);
};
