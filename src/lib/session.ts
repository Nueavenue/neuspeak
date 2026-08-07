// src/lib/session.ts
/**
 * Single source of truth for NeuSpeak's client-side conversation/session
 * state machine. Both the legacy handshake (mic permission + /api/health)
 * and the live Realtime/WebRTC session report into this same vocabulary so
 * the header, start button, and debug panel never disagree about what's
 * actually happening.
 *
 *   idle          → before any attempt
 *   mic           → requesting microphone permission
 *   connecting    → health check / realtime handshake in flight
 *   connected     → conversation active, coach is listening
 *   sending       → a request/response is in flight (user turn or assistant reply)
 *   disconnecting → user pressed "End conversation", cleanup running
 *   disconnected  → session fully closed, no more API calls will fire
 *   error         → the attempt (start, or an in-session call) failed
 */
export type SessionState =
	| 'idle'
	| 'mic'
	| 'connecting'
	| 'connected'
	| 'sending'
	| 'disconnecting'
	| 'disconnected'
	| 'error';

export const SESSION_STATES: SessionState[] = [
	'idle',
	'mic',
	'connecting',
	'connected',
	'sending',
	'disconnecting',
	'disconnected',
	'error'
];

export const SESSION_STATE_LABELS: Record<SessionState, string> = {
	idle: 'Idle',
	mic: 'Mic',
	connecting: 'Connecting',
	connected: 'Connected',
	sending: 'Sending',
	disconnecting: 'Disconnecting',
	disconnected: 'Disconnected',
	error: 'Error'
};

/** States where a live conversation turn can actually be sent/received. */
export function isSessionActive(state: SessionState): boolean {
	return state === 'connected' || state === 'sending';
}

/** States where no session exists and none is being torn down — a fresh Start is safe. */
export function isSessionAtRest(state: SessionState): boolean {
	return state === 'idle' || state === 'disconnected' || state === 'error';
}

/** States where the Start/Restart button should be disabled (an attempt is already in flight). */
export function isSessionBusy(state: SessionState): boolean {
	return state === 'mic' || state === 'connecting' || state === 'disconnecting';
}
