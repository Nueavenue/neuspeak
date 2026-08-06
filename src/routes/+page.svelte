<script>
	import HeaderStatus from '$lib/components/HeaderStatus.svelte';
	import StartButton from '$lib/components/StartButton.svelte';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import ChatLog from '$lib/components/ChatLog.svelte';
	import DebugPanel from '$lib/components/DebugPanel.svelte';

	/**
	 * @typedef {'idle' | 'mic' | 'connecting' | 'ready' | 'error'} ConnState
	 * @typedef {{ role: 'user' | 'assistant'; text: string }} ChatMessage
	 */

	/** @type {ConnState} */
	let connState = $state('idle');
	/** @type {ChatMessage[]} */
	let messages = $state([]);
	/** @type {string[]} */
	let logs = $state([]);
	let draft = $state('');
	let sending = $state(false);

	/** @type {ReturnType<typeof VoiceRecorder> | undefined} */
	let voiceRecorder = $state();

	function pushLog(entry) {
		const stamp = new Date().toLocaleTimeString();
		logs = [`[${stamp}] ${entry}`, ...logs].slice(0, 40);
	}

	function handlePhase(phase) {
		connState = phase;
	}

	function handleSuccess() {
		connState = 'ready';
		pushLog('Connection ready');
	}

	function handleError(message) {
		connState = 'error';
		pushLog(`Failed: ${message}`);
	}

	function handleVoiceStart() {
		pushLog('Voice: recording started');
	}

	function handleVoiceStop(blob) {
		pushLog(`Voice: recording stopped (${(blob.size / 1024).toFixed(1)} KB, ${blob.type})`);
	}

	async function handleVoiceSend(blob) {
		pushLog(`Voice: sending ${(blob.size / 1024).toFixed(1)} KB clip…`);
		// TODO(Step 2/3): POST to /api/asr for a transcript, then /api/coach for a reply.
		await new Promise((resolve) => setTimeout(resolve, 400));
		pushLog('Voice: send pipeline not wired yet — recorder reset');
		voiceRecorder?.resetAfterSend();
	}

	async function sendMessage(event) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || sending) return;

		if (connState !== 'ready') {
			pushLog('Send blocked — start a conversation first');
			return;
		}

		sending = true;
		messages = [...messages, { role: 'user', text }];
		draft = '';
		pushLog(`Sending to /api/ai: "${text}"`);

		const started = performance.now();

		try {
			const res = await fetch('/api/ai', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message: text })
			});

			const elapsed = Math.round(performance.now() - started);
			const data = await res.json();

			if (!res.ok) {
				throw new Error(data?.error || `AI request failed (${res.status})`);
			}

			messages = [...messages, { role: 'assistant', text: data.reply }];
			pushLog(`AI reply in ${elapsed}ms`);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Send failed';
			connState = 'error';
			pushLog(`AI error: ${message}`);
		} finally {
			sending = false;
		}
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
			busy={sending}
			onphase={handlePhase}
			onsuccess={handleSuccess}
			onerror={handleError}
			onlog={pushLog}
		/>
	</section>

	{#if connState === 'ready'}
		<VoiceRecorder
			bind:this={voiceRecorder}
			onstart={handleVoiceStart}
			onstop={handleVoiceStop}
			onsend={handleVoiceSend}
			onlog={pushLog}
		/>
	{/if}

	<ChatLog {messages} />

	<form class="rounded-[1.75rem] bg-white p-3 shadow-soft sm:p-4" onsubmit={sendMessage}>
		<label class="sr-only" for="practice-input">Practice message</label>
		<div class="flex gap-2">
			<input
				id="practice-input"
				class="min-w-0 flex-1 rounded-[1.25rem] border border-cream-200 bg-cream-50 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-soft focus:border-brand focus:bg-white"
				placeholder={connState === 'ready' ? 'Type a practice line…' : 'Start conversation first…'}
				bind:value={draft}
				disabled={sending || connState !== 'ready'}
			/>
			<button
				type="submit"
				class="rounded-[1.25rem] bg-ink px-4 py-3 text-sm font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
				disabled={sending || connState !== 'ready' || !draft.trim()}
			>
				{sending ? '…' : 'Send'}
			</button>
		</div>
	</form>

	<DebugPanel {logs} />
</main>
