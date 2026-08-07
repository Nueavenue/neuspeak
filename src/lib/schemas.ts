import { z } from 'zod';

export const healthResponseSchema = z.object({
	ok: z.literal(true),
	ts: z.number()
});

export const aiRequestSchema = z.object({
	message: z
		.string()
		.trim()
		.min(1, 'Message is required')
		.max(4000, 'Message is too long (max 4000 characters)')
});

export const aiResponseSchema = z.object({
	reply: z.string(),
	audio: z
		.object({
			data: z.string(), // base64-encoded audio bytes
			format: z.string()
		})
		.optional()
});

export const asrResponseSchema = z.object({
	transcript: z.string(),
	durationMs: z.number(),
	confidence: z.number().min(0).max(1)
});

export const realtimeSessionResponseSchema = z.object({
	value: z.string(),
	expiresAt: z.number().nullable()
});

const battleScoreSchema = z.object({
	overall: z.number().min(0).max(100),
	fluency: z.number().min(0).max(100),
	vocabulary: z.number().min(0).max(100),
	grammar: z.number().min(0).max(100),
	feedback: z.string()
});

const battleHistoryItemSchema = z.object({
	id: z.string(),
	transcript: z.string(),
	points: z.number(),
	feedback: z.string(),
	durationMs: z.number(),
	createdAt: z.string()
});

export const accountStatsSchema = z.object({
	id: z.string(),
	totalPoints: z.number(),
	battleCount: z.number(),
	rank: z.number(),
	totalAccounts: z.number(),
	history: z.array(battleHistoryItemSchema)
});

export const battleResponseSchema = z.object({
	transcript: z.string(),
	score: battleScoreSchema,
	points: z.number(),
	stats: accountStatsSchema
});

export const leaderboardEntrySchema = z.object({
	rank: z.number(),
	id: z.string(),
	totalPoints: z.number(),
	battles: z.number()
});

export const leaderboardResponseSchema = z.object({
	leaderboard: z.array(leaderboardEntrySchema)
});

export const errorResponseSchema = z.object({
	error: z.string(),
	/** Short machine-friendly category, e.g. "invalid_input", "upstream_error". */
	info: z.string().optional()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;
export type AsrResponse = z.infer<typeof asrResponseSchema>;
export type AccountStats = z.infer<typeof accountStatsSchema>;
export type BattleResponse = z.infer<typeof battleResponseSchema>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
