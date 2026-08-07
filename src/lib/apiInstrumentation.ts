import type { SessionState } from '$lib/session';

/**
 * Lightweight client-side instrumentation for calls to /api/asr and /api/ai.
 *
 * Its only job is to catch "stray" calls — requests fired by a stale event
 * listener, timer, or recorder callback after the user has ended (or before
 * they've started) the conversation. It never blocks a real call; it just
 * makes the mistake loud instead of silent.
 */

export interface StrayCallReport {
	route: string;
	state: SessionState;
	message: string;
	isStray: boolean;
}

/** States in which an /api/asr or /api/ai call is expected/legitimate. */
const EXPECTED_STATES: SessionState[] = ['connected', 'sending'];

/**
 * Call this at the top of every client function that hits /api/asr or
 * /api/ai. Returns a report describing the call, and flags it as a
 * `stray` call when the session state says no call should be happening.
 *
 * This does NOT throw or block the request by default — in dev mode it
 * always logs to the console, and callers should also surface `stray`
 * reports in the UI (e.g. the debug panel) so they're impossible to miss.
 */
export function reportApiCall(route: string, state: SessionState): StrayCallReport {
	const isExpected = EXPECTED_STATES.includes(state);
	const message = isExpected
		? `/api/${route} called (state=${state})`
		: `Unexpected /api/${route} call while state="${state}" — looks like a stray call ` +
			`(stale listener, timer, or recorder callback firing after end/before start?).`;

	if (import.meta.env.DEV) {
		if (isExpected) {
			console.debug(`[api] ${message}`);
		} else {
			console.warn(`[stray-call] ${message}`);
		}
	}

	return { route, state, message, isStray: !isExpected };
}
