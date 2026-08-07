import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAccountStats } from '$lib/server/leaderboard';
import { accountStatsSchema } from '$lib/schemas';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const stats = await getAccountStats(locals.accountId);
		return json(accountStatsSchema.parse(stats));
	} catch (err) {
		console.error('GET /api/me failed', err);
		return json({ error: 'Could not load account stats' }, { status: 500 });
	}
};
