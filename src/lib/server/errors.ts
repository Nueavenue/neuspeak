// src/lib/server/errors.ts
import { json } from '@sveltejs/kit';

/**
 * Short, machine-friendly category for an error response — lets the client
 * (or the debug panel) branch on *why* a call failed without parsing the
 * human-readable `error` message.
 */
export type ApiErrorInfo =
	| 'invalid_content_type'
	| 'invalid_input'
	| 'payload_too_large'
	| 'upstream_auth_error'
	| 'upstream_error'
	| 'server_error'
	| 'unauthenticated'
	| 'not_found'
	| 'db_error';

interface ApiErrorOptions {
	/** e.g. "POST /api/ai" — only ever printed to the server console. */
	route: string;
	status: number;
	/** Safe, user-facing message. Never include upstream error details here. */
	error: string;
	info: ApiErrorInfo;
	/** Server-only high-level reason for the log line, e.g. "Invalid content-type". */
	reason?: string;
	/** Server-only: the original error/exception, logged in a redacted form. */
	cause?: unknown;
}

/** Pulls out a few safe-to-log fields from an unknown thrown value — never
 * the full object, which could carry response headers/bodies we don't want
 * in logs (even though OpenAI's SDK errors don't include the API key, this
 * keeps logs minimal and secret-free by construction, not by luck). */
function describeCause(cause: unknown): Record<string, unknown> | undefined {
	if (!cause) return undefined;
	if (cause instanceof Error) {
		const withStatus = cause as Error & { status?: unknown; code?: unknown; type?: unknown };
		return {
			name: cause.name,
			message: cause.message,
			status: withStatus.status,
			code: withStatus.code,
			type: withStatus.type
		};
	}
	return { value: String(cause) };
}

/**
 * Builds a consistent `{ error, info }` JSON error response and logs a
 * single, secret-free line server-side: route, status, and a high-level
 * reason. Use this (or `upstreamError`) for every error path in an API
 * route instead of hand-rolling `json({ error }, { status })`.
 */
export function apiError({ route, status, error, info, reason, cause }: ApiErrorOptions): Response {
	const details = describeCause(cause);
	console.error(`[${route}] ${status} ${reason ?? info}`, details ?? '');
	return json({ error, info }, { status });
}

/**
 * Maps an unknown error caught around an OpenAI SDK call to a safe API
 * response. OpenAI SDK errors (`APIError`) carry a `status` from the
 * upstream HTTP response — 401/403 means our server's API key/config is
 * wrong (not the caller's fault, but worth surfacing distinctly so it isn't
 * mistaken for a transient outage); anything else upstream is a generic
 * 502. The client never sees OpenAI's actual response body.
 */
export function upstreamError(route: string, cause: unknown): Response {
	const status =
		cause instanceof Error ? (cause as Error & { status?: unknown }).status : undefined;

	if (status === 401 || status === 403) {
		return apiError({
			route,
			status: status as number,
			error: 'AI service is misconfigured — please contact the site owner.',
			info: 'upstream_auth_error',
			reason: 'OpenAI authentication/authorization error',
			cause
		});
	}

	return apiError({
		route,
		status: 502,
		error: 'AI service is unavailable right now — please try again.',
		info: 'upstream_error',
		reason: 'OpenAI request failed',
		cause
	});
}
