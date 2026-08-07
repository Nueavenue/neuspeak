<script>
	/**
	 * @typedef {'idle' | 'recording' | 'review' | 'sending'} RecorderState
	 */

	/** @type {{
	 *   disabled?: boolean,
	 *   onstart?: () => void,
	 *   onstop?: (blob: Blob) => void,
	 *   onsend?: (blob: Blob, durationMs: number) => void,
	 *   onlog?: (entry: string) => void
	 * }} */
	let { disabled = false, onstart, onstop, onsend, onlog } = $props();

	/** @type {RecorderState} */
	let recState = $state('idle');
	let elapsedMs = $state(0);
	let level = $state(0);
	let isPlaying = $state(false);
	let errorMessage = $state('');
	/** @type {Blob | null} */
	let audioBlob = $state(null);
	/** @type {string | null} */
	let audioUrl = $state(null);

	/** @type {MediaRecorder | null} */
	let mediaRecorder = null;
	/** @type {MediaStream | null} */
	let stream = null;
	/** @type {Blob[]} */
	let chunks = [];
	/** @type {AudioContext | null} */
	let audioCtx = null;
	/** @type {AnalyserNode | null} */
	let analyser = null;
	/** @type {HTMLAudioElement | undefined} */
	let audioEl = $state();

	let rafId = 0;
	let timerId = 0;
	let startedAt = 0;

	function log(entry) {
		onlog?.(entry);
	}

	function formatTime(ms) {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	}

	function tickLevel() {
		if (!analyser) return;
		const data = new Uint8Array(analyser.fftSize);
		analyser.getByteTimeDomainData(data);

		let sumSquares = 0;
		for (let i = 0; i < data.length; i++) {
			const normalized = (data[i] - 128) / 128;
			sumSquares += normalized * normalized;
		}

		level = Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
		rafId = requestAnimationFrame(tickLevel);
	}

	function startTimer() {
		startedAt = performance.now();
		elapsedMs = 0;
		timerId = setInterval(() => {
			elapsedMs = performance.now() - startedAt;
		}, 100);
	}

	function stopTimer() {
		clearInterval(timerId);
	}

	function cleanupStream() {
		cancelAnimationFrame(rafId);
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		audioCtx?.close();
		audioCtx = null;
		analyser = null;
		level = 0;
	}

	async function startRecording() {
		if (disabled || recState === 'recording') return;
		errorMessage = '';

		if (typeof MediaRecorder === 'undefined') {
			errorMessage = 'Recording is not supported in this browser';
			log('Recording error: MediaRecorder unsupported');
			return;
		}

		try {
			log('Requesting microphone for recording…');
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
				? 'audio/webm;codecs=opus'
				: 'audio/webm';

			mediaRecorder = new MediaRecorder(stream, { mimeType });
			chunks = [];

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};

			mediaRecorder.onstop = () => {
				const blob = new Blob(chunks, { type: mimeType });
				audioBlob = blob;
				audioUrl = URL.createObjectURL(blob);
				recState = 'review';
				stopTimer();
				cleanupStream();
				log(`Recording stopped — ${(blob.size / 1024).toFixed(1)} KB`);
				onstop?.(blob);
			};

			audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(stream);
			analyser = audioCtx.createAnalyser();
			analyser.fftSize = 1024;
			source.connect(analyser);

			mediaRecorder.start();
			recState = 'recording';
			startTimer();
			tickLevel();
			log('Recording started');
			onstart?.();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Could not access microphone';
			errorMessage = message;
			log(`Recording error: ${message}`);
			recState = 'idle';
			cleanupStream();
		}
	}

	function stopRecording() {
		if (recState !== 'recording') return;
		mediaRecorder?.stop();
	}

	function reRecord() {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		audioBlob = null;
		audioUrl = null;
		isPlaying = false;
		errorMessage = '';
		recState = 'idle';
		elapsedMs = 0;
		log('Discarded recording — ready to re-record');
	}

	function togglePlayback() {
		if (!audioEl) return;
		if (isPlaying) {
			audioEl.pause();
		} else {
			audioEl.play();
		}
	}

	function handleSend() {
		if (!audioBlob || recState === 'sending') return;
		recState = 'sending';
		log('Sending recording…');
		onsend?.(audioBlob, elapsedMs);
	}

	export function resetAfterSend() {
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		audioBlob = null;
		audioUrl = null;
		isPlaying = false;
		errorMessage = '';
		recState = 'idle';
		elapsedMs = 0;
	}

	export function markError(message) {
		errorMessage = message;
		recState = 'review';
	}

	$effect(() => {
		return () => {
			cleanupStream();
			stopTimer();
			if (audioUrl) URL.revokeObjectURL(audioUrl);
		};
	});
</script>

<section class="rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
	<div class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold text-ink">Your turn to speak</h2>
			<p class="mt-0.5 text-sm text-ink-muted">Record, review, then send your voice.</p>
		</div>
		<span class="rounded-2xl bg-cream-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-muted">
			{formatTime(elapsedMs)}
		</span>
	</div>

	{#if errorMessage}
		<p class="mb-4 rounded-2xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{errorMessage}</p>
	{/if}

	<div class="mb-5 flex h-10 items-center justify-center gap-1.5" aria-hidden="true">
		{#each Array(7) as _, i}
			<span
				class="w-1.5 rounded-full bg-gradient-to-t from-brand to-brand-light transition-[height] duration-100"
				style="height: {recState === 'recording'
					? Math.max(6, Math.min(1, level * (0.55 + (i % 3) * 0.25)) * 36)
					: 6}px"
			></span>
		{/each}
	</div>

	<div class="flex items-center justify-center gap-3">
		{#if recState === 'idle'}
			<button
				type="button"
				class="flex flex-col items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
				{disabled}
				onclick={startRecording}
			>
				<span
					class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-brand-light to-brand text-white shadow-card transition enabled:group-hover:brightness-105"
				>
					<svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3z"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</span>
				<span class="text-xs font-semibold text-ink-muted">Record</span>
			</button>
		{:else if recState === 'recording'}
			<button type="button" class="flex flex-col items-center gap-2" onclick={stopRecording}>
				<span class="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-card">
					<span class="absolute inset-0 -m-1.5 animate-ping rounded-full bg-red-400/40"></span>
					<svg class="relative h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
				</span>
				<span class="text-xs font-semibold text-red-500">Stop</span>
			</button>
		{:else}
			<button
				type="button"
				class="flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-ink transition enabled:hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={recState === 'sending'}
				onclick={togglePlayback}
				aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
			>
				{#if isPlaying}
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"
						><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg
					>
				{:else}
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z" /></svg>
				{/if}
			</button>

			<button
				type="button"
				class="rounded-2xl bg-cream-100 px-4 py-3 text-sm font-semibold text-ink-muted transition enabled:hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={recState === 'sending'}
				onclick={reRecord}
			>
				Re-record
			</button>

			<button
				type="button"
				class="rounded-2xl bg-ink px-5 py-3 text-sm font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-60"
				disabled={recState === 'sending'}
				onclick={handleSend}
			>
				{recState === 'sending' ? 'Sending…' : 'Send'}
			</button>
		{/if}
	</div>

	{#if audioUrl}
		<audio
			bind:this={audioEl}
			src={audioUrl}
			class="hidden"
			onplay={() => (isPlaying = true)}
			onpause={() => (isPlaying = false)}
			onended={() => (isPlaying = false)}
		></audio>
	{/if}
</section>
