<!-- src/lib/components/DebugPanel.svelte -->
<script>
	import { SESSION_STATE_LABELS } from '$lib/session';
	import { reportApiCall } from '$lib/apiInstrumentation';

	/**
	 * @typedef {import('$lib/session').SessionState} ConnState
	 * @typedef {{ ok: boolean; status: number; message: string; at: number } | null} ApiCallInfo
	 * @typedef {{ health: ApiCallInfo; asr: ApiCallInfo; ai: ApiCallInfo }} ApiCalls
	 */

	/** @type {{
	 *   logs: string[],
	 *   state?: ConnState,
	 *   apiCalls?: ApiCalls,
	 *   lastError?: string,
	 *   lastChangeAt?: number | null,
	 *   forceShow?: boolean,
	 *   onapicall?: (route: 'asr' | 'ai', info: { ok: boolean; status: number; message: string }) => void
	 * }} */
	let {
		logs,
		// Renamed from the prop name `state` to avoid ambiguity with the
		// `$state` rune used below (Svelte warns about `$`-prefixed locals).
		state: connState = 'idle',
		apiCalls = { health: null, asr: null, ai: null },
		lastError = '',
		lastChangeAt = null,
		forceShow = false,
		onapicall
	} = $props();

	// Hidden by default in production builds — pass forceShow to opt back in
	// (e.g. for a staging environment) without needing a dev build.
	const visible = $derived(import.meta.env.DEV || forceShow);

	let testingAsr = $state(false);
	let testingAi = $state(false);
	/** Set when a test button fires while the session isn't connected — makes
	 * stray/out-of-state calls impossible to miss instead of just a console log. */
	let strayCallWarning = $state('');

	const stateLabels = SESSION_STATE_LABELS;

	function formatTime(ts) {
		if (!ts) return '—';
		return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
	}

	function truncate(text, max = 70) {
		if (!text) return '';
		return text.length > max ? `${text.slice(0, max)}…` : text;
	}

	/** A minimal, non-empty "audio" blob — enough to pass basic validation and
	 * exercise the real /api/asr round-trip (it'll likely come back as a 422
	 * "no speech" or a transcription error, which is a fine test of the error
	 * path too). */
	async function testAsr() {
		if (testingAsr) return;
		testingAsr = true;
		try {
			const report = reportApiCall('asr', connState);
			if (report.isStray) strayCallWarning = report.message;
			const blob = new Blob([new Uint8Array(32)], { type: 'audio/webm' });
			const res = await fetch('/api/asr', {
				method: 'POST',
				headers: { 'content-type': 'audio/webm' },
				body: blob
			});
			const data = await res.json().catch(() => ({}));
			onapicall?.('asr', {
				ok: res.ok,
				status: res.status,
				message: res.ok ? `transcript: "${truncate(data.transcript, 40)}"` : (data.error ?? `HTTP ${res.status}`)
			});
		} catch (err) {
			onapicall?.('asr', {
				ok: false,
				status: 0,
				message: err instanceof Error ? err.message : 'Network error'
			});
		} finally {
			testingAsr = false;
		}
	}

	async function testAi() {
		if (testingAi) return;
		testingAi = true;
		try {
			const report = reportApiCall('ai', connState);
			if (report.isStray) strayCallWarning = report.message;
			const res = await fetch('/api/ai', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ message: 'Debug panel test message' })
			});
			const data = await res.json().catch(() => ({}));
			onapicall?.('ai', {
				ok: res.ok,
				status: res.status,
				message: res.ok ? `reply: "${truncate(data.reply, 40)}"` : (data.error ?? `HTTP ${res.status}`)
			});
		} catch (err) {
			onapicall?.('ai', {
				ok: false,
				status: 0,
				message: err instanceof Error ? err.message : 'Network error'
			});
		} finally {
			testingAi = false;
		}
	}

	const callRows = /** @type {const} */ ([
		{ key: 'health', label: '/api/health' },
		{ key: 'asr', label: '/api/asr' },
		{ key: 'ai', label: '/api/ai' }
	]);
</script>

{#if visible}
	<section class="rounded-[1.75rem] border border-white/60 bg-white/70 p-4 shadow-soft backdrop-blur-md sm:p-5">
		<div class="mb-3 flex items-center justify-between gap-3">
			<div>
				<h2 class="text-lg font-bold text-ink">Debug</h2>
				<p class="mt-0.5 text-sm text-ink-muted">Connection, API calls, events, and errors</p>
			</div>
			<span class="rounded-2xl bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-muted">
				{logs.length}
			</span>
		</div>

		<div class="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-cream-50 px-3.5 py-2.5">
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold uppercase tracking-wide text-ink-soft">State</span>
				<span
					class="rounded-xl px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide
					{connState === 'error'
						? 'bg-red-500 text-white'
						: connState === 'connected' || connState === 'sending'
							? 'bg-brand text-white'
							: connState === 'disconnecting'
								? 'bg-amber-500 text-white'
								: 'bg-ink text-white'}"
				>
					{stateLabels[connState] ?? connState}
				</span>
			</div>
			<span class="text-[11px] font-medium text-ink-soft">Last change: {formatTime(lastChangeAt)}</span>
		</div>

		{#if lastError}
			<p class="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
				Last error: {lastError}
			</p>
		{/if}

		{#if strayCallWarning}
			<p class="mb-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
				<span>⚠</span>
				<span class="flex-1">{strayCallWarning}</span>
				<button
					type="button"
					class="shrink-0 font-bold text-amber-800 underline"
					onclick={() => (strayCallWarning = '')}
				>
					Dismiss
				</button>
			</p>
		{/if}

		<div class="mb-3 flex flex-col gap-1.5">
			{#each callRows as row (row.key)}
				{@const call = apiCalls[row.key]}
				<div class="flex items-center justify-between gap-2 rounded-2xl bg-cream-50 px-3 py-2">
					<div class="flex min-w-0 items-center gap-2">
						<span
							class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white
							{call === null ? 'bg-ink-soft/40' : call.ok ? 'bg-brand' : 'bg-red-500'}"
							aria-hidden="true"
						>
							{call === null ? '–' : call.ok ? '✓' : '✕'}
						</span>
						<span class="shrink-0 font-mono text-xs font-semibold text-ink">{row.label}</span>
						<span class="truncate text-[11px] text-ink-soft">{call?.message ?? 'not called yet'}</span>
					</div>
					<div class="shrink-0 text-right">
						{#if call}
							<p class="font-mono text-[11px] font-bold {call.ok ? 'text-brand-dark' : 'text-red-500'}">
								{call.status}
							</p>
							<p class="text-[10px] text-ink-soft">{formatTime(call.at)}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		{#if import.meta.env.DEV}
			<div class="mb-1.5 flex gap-2">
				<button
					type="button"
					class="flex-1 rounded-xl bg-ink px-3 py-2 text-[11px] font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
					disabled={testingAsr}
					onclick={testAsr}
				>
					{testingAsr ? 'Testing…' : 'Test /api/asr'}
				</button>
				<button
					type="button"
					class="flex-1 rounded-xl bg-ink px-3 py-2 text-[11px] font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
					disabled={testingAi}
					onclick={testAi}
				>
					{testingAi ? 'Testing…' : 'Test /api/ai'}
				</button>
			</div>
			<p class="mb-3 text-[10px] text-ink-soft">
				Fires the real route regardless of state — flags a warning above if the session isn't
				connected/sending, so you can see what a stray call looks like.
			</p>
		{/if}

		<div
			class="max-h-44 overflow-y-auto rounded-bubble bg-ink px-3 py-3 font-mono text-[11px] leading-relaxed text-cream-100"
		>
			{#if logs.length === 0}
				<p class="text-ink-soft">Waiting for events…</p>
			{:else}
				{#each logs as entry, i (i)}
					<p class="border-b border-white/5 py-1 last:border-0">
						<span class="text-brand-light">{String(i + 1).padStart(2, '0')}</span>
						{entry}
					</p>
				{/each}
			{/if}
		</div>
	</section>
{/if}
