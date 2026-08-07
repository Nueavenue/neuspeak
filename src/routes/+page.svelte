<script>
	import { tick, onMount } from 'svelte';
	import HeaderStatus from '$lib/components/HeaderStatus.svelte';
	import StartButton from '$lib/components/StartButton.svelte';
	import RealtimeVoice from '$lib/components/RealtimeVoice.svelte';
	import ChatLog from '$lib/components/ChatLog.svelte';
	import DebugPanel from '$lib/components/DebugPanel.svelte';

	/**
	 * @typedef {import('$lib/session').SessionState} SessionState
	 * @typedef {{ role: 'user' | 'assistant'; text: string; streaming?: boolean }} ChatMessage
	 * @typedef {{ id: string; totalPoints: number; battleCount: number; rank: number; totalAccounts: number }} AccountStats
	 * @typedef {{ ok: boolean; status: number; message: string; at: number } | null} ApiCallInfo
	 * @typedef {{ health: ApiCallInfo; asr: ApiCallInfo; ai: ApiCallInfo }} ApiCalls
	 */

	// A single state machine drives the header badge, the Start/Restart
	// button, and the debug panel. StartButton reports the 'mic' /
	// 'connecting' pre-flight phases; RealtimeVoice reports every phase of
	// the live session ('connecting' → 'connected' → 'sending' →
	// 'disconnecting' → 'disconnected'). Nobody else is allowed to invent a
	// different vocabulary — see src/lib/session.ts.
	/** @type {SessionState} */
	let sessionState = $state('idle');
	// True once the user has started at least once — keeps the RealtimeVoice
	// panel mounted (so "Conversation ended" is visible) instead of yanking
	// it away the instant the session closes.
	let hasStarted = $state(false);
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {string[]} */
	let logs = $state([]);
	let draft = $state('');
	/** @type {AccountStats | null} */
	let battleStats = $state(null);

	// Debug-panel-only state: never derived from anything secret, purely a
	// mirror of client-visible connection/API-call outcomes.
	/** @type {ApiCalls} */
	let apiCalls = $state({ health: null, asr: null, ai: null });
	let lastError = $state('');
	let lastChangeAt = $state(/** @type {number | null} */ (null));

	/** @type {ReturnType<typeof RealtimeVoice> | undefined} */
	let realtimeVoice = $state();

	onMount(async () => {
		try {
			const res = await fetch('/api/me');
			if (res.ok) battleStats = await res.json();
		} catch {
			// Non-critical — the voice battle card just shows a loading state.
		}
	});

	function pushLog(entry) {
		const stamp = new Date().toLocaleTimeString();
		logs = [`[${stamp}] ${entry}`, ...logs].slice(0, 40);
	}

	function handlePhase(phase) {
		sessionState = phase;
		lastChangeAt = Date.now();
	}

	async function handleSuccess() {
		hasStarted = true;
		pushLog('Health check passed — starting live voice session…');
		await tick();
		await realtimeVoice?.connect();
	}

	function handleError(message) {
		sessionState = 'error';
		lastError = message;
		lastChangeAt = Date.now();
		pushLog(`Failed: ${message}`);
	}

	/**
	 * @param {'health' | 'asr' | 'ai'} route
	 * @param {{ ok: boolean; status: number; message: string }} info
	 */
	function handleApiCall(route, info) {
		apiCalls = { ...apiCalls, [route]: { ...info, at: Date.now() } };
		pushLog(`/api/${route} → ${info.ok ? 'OK' : 'FAIL'} (${info.status}) ${info.message}`);
	}

	/** @param {SessionState} status */
	function handleRealtimeStatus(status) {
		sessionState = status;
		lastChangeAt = Date.now();
		if (status === 'error') {
			lastError = lastError || 'Realtime session failed';
		}
	}

	/** @param {string} text */
	function handleUserTranscript(text) {
		messages = [...messages, { role: 'user', text }];
	}

	/** @param {string} delta */
	function handleAssistantDelta(delta) {
		if (!delta) return;
		const last = messages[messages.length - 1];
		if (last?.role === 'assistant' && last.streaming) {
			messages = [...messages.slice(0, -1), { ...last, text: last.text + delta }];
		} else {
			messages = [...messages, { role: 'assistant', text: delta, streaming: true }];
		}
	}

	/** @param {string} fullText */
	function handleAssistantDone(fullText) {
		const last = messages[messages.length - 1];
		if (last?.role === 'assistant' && last.streaming) {
			messages = [...messages.slice(0, -1), { role: 'assistant', text: fullText || last.text, streaming: false }];
		} else if (fullText) {
			messages = [...messages, { role: 'assistant', text: fullText, streaming: false }];
		}
	}

	function handleRealtimeError(message) {
		pushLog(`Realtime error: ${message}`);
	}

	function sendMessage(event) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || sessionState !== 'connected') return;

		messages = [...messages, { role: 'user', text }];
		draft = '';
		pushLog(`Sending: "${text}"`);
		realtimeVoice?.sendText(text);
	}
</script>

<main class="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
	<HeaderStatus state={sessionState} />

	<section class="rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
		<div class="flex items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="text-sm font-medium text-ink-muted">Voice Battle</p>
				{#if battleStats}
					<p class="text-base font-bold text-ink">Rank #{battleStats.rank} · {battleStats.totalPoints} pts</p>
					<p class="mt-0.5 truncate text-xs text-ink-soft">
						{battleStats.id} · {battleStats.battleCount}
						{battleStats.battleCount === 1 ? 'battle' : 'battles'}
					</p>
				{:else}
					<p class="text-base font-bold text-ink">Loading your stats…</p>
				{/if}
			</div>
			<a
				href="/practice"
				class="shrink-0 rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand"
			>
				Enter battle
			</a>
		</div>
	</section>

	<section class="rounded-[1.75rem] bg-white/80 p-4 shadow-soft backdrop-blur-sm sm:p-5">
		<div class="mb-4 flex items-center justify-between gap-3">
			<div>
				<p class="text-sm font-medium text-ink-muted">Welcome back</p>
				<p class="text-base font-bold text-ink">Let’s get you sounding more natural</p>
			</div>
			<div
				class="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark"
			>
				NS
			</div>
		</div>

		<div class="mb-5">
			<div class="mb-1.5 flex items-center justify-between text-xs font-semibold">
				<span class="text-ink-muted">Level progress</span>
				<span class="text-brand-dark">Part 1 · Shell</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-cream-200">
				<div class="h-full w-1/3 rounded-full bg-gradient-to-r from-brand to-brand-light"></div>
			</div>
		</div>

		<StartButton
			state={sessionState}
			onphase={handlePhase}
			onsuccess={handleSuccess}
			onerror={handleError}
			onlog={pushLog}
			onapicall={handleApiCall}
		/>
	</section>

	{#if hasStarted}
		<RealtimeVoice
			bind:this={realtimeVoice}
			onstatus={handleRealtimeStatus}
			onlog={pushLog}
			onerror={handleRealtimeError}
			onusertranscript={handleUserTranscript}
			onassistantdelta={handleAssistantDelta}
			onassistantdone={handleAssistantDone}
		/>
	{/if}

	<ChatLog {messages} />

	<form class="rounded-[1.75rem] bg-white p-3 shadow-soft sm:p-4" onsubmit={sendMessage}>
		<label class="sr-only" for="practice-input">Practice message</label>
		<div class="flex gap-2">
			<input
				id="practice-input"
				class="min-w-0 flex-1 rounded-[1.25rem] border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-brand focus:bg-white"
				placeholder={sessionState === 'connected' ? 'Or type a practice line…' : 'Start conversation first…'}
				bind:value={draft}
				disabled={sessionState !== 'connected'}
			/>
			<button
				type="submit"
				class="rounded-[1.25rem] bg-ink px-4 py-3 text-sm font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
				disabled={sessionState !== 'connected' || !draft.trim()}
			>
				Send
			</button>
		</div>
	</form>

	<DebugPanel {logs} state={sessionState} {apiCalls} {lastError} {lastChangeAt} onapicall={handleApiCall} />
</main>
