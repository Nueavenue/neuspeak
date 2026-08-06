<script>
	/**
	 * @typedef {'idle' | 'mic' | 'connecting' | 'ready' | 'error'} ConnState
	 */

	/** @type {{
	 *   state: ConnState,
	 *   busy?: boolean,
	 *   onphase?: (phase: 'mic' | 'connecting') => void,
	 *   onsuccess?: () => void,
	 *   onerror?: (message: string) => void,
	 *   onlog?: (entry: string) => void
	 * }} */
	let { state, busy = false, onphase, onsuccess, onerror, onlog } = $props();

	function log(entry) {
		onlog?.(entry);
	}

	async function handleClick() {
		if (busy || state === 'connecting' || state === 'mic') return;

		try {
			onphase?.('mic');
			log('Requesting microphone permission…');

			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			stream.getTracks().forEach((track) => track.stop());
			log('Microphone permission granted');

			onphase?.('connecting');
			log('Pinging /api/health…');
			const started = performance.now();
			const res = await fetch('/api/health');
			const elapsed = Math.round(performance.now() - started);

			if (!res.ok) {
				throw new Error(`Health check failed (${res.status})`);
			}

			const data = await res.json();
			if (!data?.ok) {
				throw new Error('Health check returned not ok');
			}

			log(`Health OK in ${elapsed}ms (ts=${data.ts})`);
			onsuccess?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Start failed';
			log(`Error: ${message}`);
			onerror?.(message);
		}
	}
</script>

<button
	type="button"
	class="group relative w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-brand-light to-brand px-5 pb-5 pt-8 text-left text-white shadow-card transition enabled:hover:brightness-[1.03] enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
	disabled={busy || state === 'connecting' || state === 'mic'}
	onclick={handleClick}
>
	<div class="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"></div>
	<div class="pointer-events-none absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-brand-dark/30 blur-2xl"></div>

	<p class="relative text-sm font-medium text-white/85">Practice prompt</p>
	<p class="relative mt-2 text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
		How’s the weather today?
	</p>

	<div class="relative mt-8 flex items-center justify-center gap-5">
		<span class="flex h-11 w-11 items-center justify-center rounded-full bg-white/20" aria-hidden="true">
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"
				><path d="M8 5v14l11-7L8 5z" /></svg
			>
		</span>
		<span
			class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand shadow-soft"
			aria-hidden="true"
		>
			<svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><path
					d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3z"
					stroke-linecap="round"
					stroke-linejoin="round"
				/><path
					d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</span>
		<span class="flex h-11 w-11 items-center justify-center rounded-full bg-white/20" aria-hidden="true">
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><path
					d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</span>
	</div>

	<span
		class="relative mt-8 flex w-full items-center justify-center rounded-[1.35rem] bg-white px-4 py-3.5 text-base font-bold text-brand shadow-soft"
	>
		{#if state === 'mic'}
			Allow microphone…
		{:else if state === 'connecting'}
			Connecting…
		{:else if state === 'ready'}
			Restart conversation
		{:else if state === 'error'}
			Try again
		{:else}
			Start conversation
		{/if}
	</span>
</button>
