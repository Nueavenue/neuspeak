// src/lib/server/leaderboard.ts
import { prisma } from './db';

interface RankingRow {
	accountId: string;
	totalPoints: number;
	battles: number;
}

async function computeRanking(): Promise<RankingRow[]> {
	const grouped = await prisma.battle.groupBy({
		by: ['accountId'],
		_sum: { points: true },
		_count: { _all: true }
	});

	return grouped
		.map((g) => ({
			accountId: g.accountId,
			totalPoints: g._sum.points ?? 0,
			battles: g._count._all
		}))
		.sort((a, b) => b.totalPoints - a.totalPoints);
}

export interface AccountStats {
	id: string;
	totalPoints: number;
	battleCount: number;
	rank: number;
	totalAccounts: number;
	history: Array<{
		id: string;
		transcript: string;
		points: number;
		feedback: string;
		durationMs: number;
		createdAt: string;
	}>;
}

export async function getAccountStats(accountId: string): Promise<AccountStats> {
	const [account, ranking, recentBattles] = await Promise.all([
		prisma.account.findUniqueOrThrow({ where: { id: accountId } }),
		computeRanking(),
		prisma.battle.findMany({
			where: { accountId },
			orderBy: { createdAt: 'desc' },
			take: 20
		})
	]);

	const rankIndex = ranking.findIndex((r) => r.accountId === accountId);
	const mine = rankIndex >= 0 ? ranking[rankIndex] : undefined;

	return {
		id: account.displayId,
		totalPoints: mine?.totalPoints ?? 0,
		battleCount: mine?.battles ?? 0,
		rank: rankIndex >= 0 ? rankIndex + 1 : ranking.length + 1,
		totalAccounts: rankIndex >= 0 ? ranking.length : ranking.length + 1,
		history: recentBattles.map((b) => ({
			id: b.id,
			transcript: b.transcript,
			points: b.points,
			feedback: b.feedback,
			durationMs: b.durationMs,
			createdAt: b.createdAt.toISOString()
		}))
	};
}

export interface LeaderboardEntry {
	rank: number;
	id: string;
	totalPoints: number;
	battles: number;
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
	const ranking = await computeRanking();
	const top = ranking.slice(0, limit);
	if (top.length === 0) return [];

	const accounts = await prisma.account.findMany({
		where: { id: { in: top.map((r) => r.accountId) } }
	});
	const displayIdById = new Map(accounts.map((a) => [a.id, a.displayId]));

	return top.map((r, index) => ({
		rank: index + 1,
		id: displayIdById.get(r.accountId) ?? 'Unknown',
		totalPoints: r.totalPoints,
		battles: r.battles
	}));
}
