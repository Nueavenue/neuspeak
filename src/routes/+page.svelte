<script>
	import { tick } from 'svelte';
	import HeaderStatus from '$lib/components/HeaderStatus.svelte';
	import StartButton from '$lib/components/StartButton.svelte';
	import RealtimeVoice from '$lib/components/RealtimeVoice.svelte';
	import ChatLog from '$lib/components/ChatLog.svelte';
	import DebugPanel from '$lib/components/DebugPanel.svelte';

	/**
	 * @typedef {'idle' | 'mic' | 'connecting' | 'ready' | 'error'} ConnState
	 * @typedef {'idle' | 'connecting' | 'live' | 'closed' | 'error'} RealtimeStatus
	 * @typedef {{ role: 'user' | 'assistant'; text: string; streaming?: boolean }} ChatMessage
	 */

	/** @type {ConnState} */
	let connState = $state('idle');
	/** @type {RealtimeStatus} */
	let realtimeStatus = $state('idle');
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {string[]} */
	let logs = $state([]);
	let draft = $state('');

	/** @type {ReturnType<typeof RealtimeVoice> | undefined} */
	let realtimeVoice = $state();

	function pushLog(entry) {
		const stamp = new Date().toLocaleTimeString();
		logs = [`[${stamp}] ${entry}`, ...logs].slice(0, 40);
	}

	function handlePhase(phase) {
		connState = phase;
	}

	async function handleSuccess() {
		connState = 'ready';
		pushLog('Connection ready — starting live voice session…');
		await tick();
		await realtimeVoice?.connect();
	}

	function handleError(message) {
		connState = 'error';
		pushLog(`Failed: ${message}`);
	}

	function handleRealtimeStatus(status) {
		realtimeStatus = status;
		if (status === 'error') {
			connState = 'error';
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
		if (!text || realtimeStatus !== 'live') return;

		messages = [...messages, { role: 'user', text }];
		draft = '';
		pushLog(`Sending: "${text}"`);
		realtimeVoice?.sendText(text);
	}
</script>

<main class="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
	<HeaderStatus state={connState} />

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
			state={connState}
			onphase={handlePhase}
			onsuccess={handleSuccess}
			onerror={handleError}
			onlog={pushLog}
		/>
	</section>

	{#if connState === 'ready'}
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
				placeholder={realtimeStatus === 'live' ? 'Or type a practice line…' : 'Start conversation first…'}
				bind:value={draft}
				disabled={realtimeStatus !== 'live'}
			/>
			<button
				type="submit"
				class="rounded-[1.25rem] bg-ink px-4 py-3 text-sm font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
				disabled={realtimeStatus !== 'live' || !draft.trim()}
			>
				Send
			</button>
		</div>
	</form>

	<DebugPanel {logs} />
</main>
