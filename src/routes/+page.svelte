<!-- src/routes/+page.svelte -->
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

	// The conversation history "session" (see database/create_conversation_tables.sql
	// and src/routes/api/conversations/*). One row is created per "Start
	// conversation" press; every completed turn is appended as a message.
	// Persistence is best-effort and never blocks the live UI — a failed
	// save shows up as a debug-panel log line, not a broken conversation.
	let currentConversationId = $state(/** @type {string | null} */ (null));

	onMount(async () => {
		try {
			const res = await fetch('/api/me');
			if (res.ok) battleStats = await res.json();
		} catch {
			// Non-critical — the voice battle card just shows a loading state.
		}

		/** @param {MessageEvent} ev */
		function onParentMessage(ev) {
			const msg = ev.data;
			if (!msg || typeof msg !== 'object') return;
			if (msg.type === 'osneu-ec-seed' && typeof msg.text === 'string' && msg.text.trim()) {
				draft = msg.text.trim();
				pushLog('Seeded practice line from os.neu Copy to app.neu');
			}
		}
		window.addEventListener('message', onParentMessage);

		/** @param {MouseEvent} ev */
		function onCtx(ev) {
			const selected = window.getSelection()?.toString()?.trim() || '';
			if (!selected) return;
			const embed = new URLSearchParams(window.location.search).get('embed') === 'osneu';
			if (!embed || window.parent === window) return;
			ev.preventDefault();
			window.parent.postMessage({ type: 'osneu-ec-copy-selection', text: selected }, '*');
		}
		document.addEventListener('contextmenu', onCtx);

		return () => {
			window.removeEventListener('message', onParentMessage);
			document.removeEventListener('contextmenu', onCtx);
		};
	});

	async function startConversationSession() {
		try {
			const res = await fetch('/api/conversations', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			currentConversationId = data.conversation.id;
			pushLog(`History: started session "${data.conversation.title}"`);
		} catch (err) {
			currentConversationId = null;
			pushLog(
				`History: could not start a session — ${err instanceof Error ? err.message : 'unknown error'}`
			);
		}
	}

	/**
	 * @param {'user' | 'assistant'} role
	 * @param {string} content
	 */
	async function persistMessage(role, content) {
		if (!currentConversationId || !content.trim()) return;
		try {
			const res = await fetch(`/api/conversations/${currentConversationId}/messages`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ role, content })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(data?.error || `HTTP ${res.status}`);
			}
		} catch (err) {
			pushLog(
				`History: failed to save ${role} message — ${err instanceof Error ? err.message : 'unknown error'}`
			);
		}
	}

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
		await startConversationSession();
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
		persistMessage('user', text);
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
		let finalText = '';
		if (last?.role === 'assistant' && last.streaming) {
			finalText = fullText || last.text;
			messages = [
				...messages.slice(0, -1),
				{ role: 'assistant', text: finalText, streaming: false }
			];
		} else if (fullText) {
			finalText = fullText;
			messages = [...messages, { role: 'assistant', text: finalText, streaming: false }];
		}
		if (finalText) persistMessage('assistant', finalText);
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
		persistMessage('user', text);
		realtimeVoice?.sendText(text);
	}
</script>

<main class="ns-main max-w-xl gap-5 px-4 py-6 sm:px-6 sm:py-8 mx-auto flex min-h-screen w-full flex-col">
	<HeaderStatus state={sessionState} />

	<section class="bg-white p-4 shadow-soft sm:p-5 rounded-[1.75rem]">
		<div class="gap-3 flex items-center justify-between">
			<div class="min-w-0">
				<p class="text-sm font-medium text-ink-muted">Voice Battle</p>
				{#if battleStats}
					<p class="text-base font-bold text-ink">
						Rank #{battleStats.rank} · {battleStats.totalPoints} pts
					</p>
					<p class="mt-0.5 text-xs text-ink-soft truncate">
						{battleStats.id} · {battleStats.battleCount}
						{battleStats.battleCount === 1 ? 'battle' : 'battles'}
					</p>
				{:else}
					<p class="text-base font-bold text-ink">Loading your stats…</p>
				{/if}
			</div>
			<a
				href="/practice"
				class="rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-brand shrink-0 transition"
			>
				Enter battle
			</a>
		</div>
	</section>

	<section class="bg-white/80 p-4 shadow-soft backdrop-blur-sm sm:p-5 rounded-[1.75rem]">
		<div class="mb-4 gap-3 flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-ink-muted">Welcome back</p>
				<p class="text-base font-bold text-ink">Let’s get you sounding more natural</p>
			</div>
			<div
				class="h-11 w-11 bg-brand-soft text-sm font-bold text-brand-dark flex items-center justify-center rounded-full"
			>
				NS
			</div>
		</div>

		<div class="mb-5">
			<div class="mb-1.5 text-xs font-semibold flex items-center justify-between">
				<span class="text-ink-muted">Level progress</span>
				<span class="text-brand-dark">Part 1 · Shell</span>
			</div>
			<div class="h-2 bg-cream-200 overflow-hidden rounded-full">
				<div class="from-brand to-brand-light h-full w-1/3 rounded-full bg-gradient-to-r"></div>
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

	<form class="bg-white p-3 shadow-soft sm:p-4 rounded-[1.75rem]" onsubmit={sendMessage}>
		<label class="sr-only" for="practice-input">Practice message</label>
		<div class="gap-2 flex">
			<input
				id="practice-input"
				class="min-w-0 border-cream-200 bg-cream-50 px-4 py-3 text-sm text-ink placeholder:text-ink-soft focus:border-brand focus:bg-white flex-1 rounded-[1.25rem] border transition outline-none"
				placeholder={sessionState === 'connected'
					? 'Or type a practice line…'
					: 'Start conversation first…'}
				bind:value={draft}
				disabled={sessionState !== 'connected'}
			/>
			<button
				type="submit"
				class="bg-ink px-4 py-3 text-sm font-bold text-white enabled:hover:bg-brand rounded-[1.25rem] transition disabled:cursor-not-allowed disabled:opacity-50"
				disabled={sessionState !== 'connected' || !draft.trim()}
			>
				Send
			</button>
		</div>
	</form>

	<DebugPanel
		{logs}
		state={sessionState}
		{apiCalls}
		{lastError}
		{lastChangeAt}
		onapicall={handleApiCall}
	/>
</main>
