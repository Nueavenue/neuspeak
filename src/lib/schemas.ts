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
	reply: z.string()
});

export const asrResponseSchema = z.object({
	transcript: z.string(),
	durationMs: z.number(),
	confidence: z.number().min(0).max(1)
});

export const errorResponseSchema = z.object({
	error: z.string()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;
export type AsrResponse = z.infer<typeof asrResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
