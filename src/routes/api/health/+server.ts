// src/routes/api/health/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { healthResponseSchema } from '$lib/schemas';

export const GET: RequestHandler = () => {
	const body = healthResponseSchema.parse({ ok: true, ts: Date.now() });
	return json(body);
};
