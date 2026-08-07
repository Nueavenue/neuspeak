// src/routes/api/leaderboard/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLeaderboard } from '$lib/server/leaderboard';
import { leaderboardResponseSchema } from '$lib/schemas';

export const GET: RequestHandler = async () => {
	try {
		const leaderboard = await getLeaderboard(20);
		return json(leaderboardResponseSchema.parse({ leaderboard }));
	} catch (err) {
		console.error('GET /api/leaderboard failed', err);
		return json({ error: 'Could not load leaderboard' }, { status: 500 });
	}
};
