<script>
	import { onMount } from 'svelte';
	import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
	import DebugPanel from '$lib/components/DebugPanel.svelte';

	/**
	 * @typedef {{ id: string; transcript: string; points: number; feedback: string; durationMs: number; createdAt: string }} BattleHistoryItem
	 * @typedef {{ id: string; totalPoints: number; battleCount: number; rank: number; totalAccounts: number; history: BattleHistoryItem[] }} AccountStats
	 * @typedef {{ rank: number; id: string; totalPoints: number; battles: number }} LeaderboardEntry
	 * @typedef {{ overall: number; fluency: number; vocabulary: number; grammar: number; feedback: string }} BattleScore
	 */

	/** @type {AccountStats | null} */
	let stats = $state(null);
	/** @type {LeaderboardEntry[]} */
	let leaderboard = $state([]);
	let loadingStats = $state(true);
	/** @type {string[]} */
	let logs = $state([]);
	let errorMessage = $state('');

	/** @type {{ transcript: string; score: BattleScore } | null} */
	let lastResult = $state(null);

	/** @type {ReturnType<typeof VoiceRecorder> | undefined} */
	let voiceRecorder = $state();

	function pushLog(entry) {
		const stamp = new Date().toLocaleTimeString();
		logs = [`[${stamp}] ${entry}`, ...logs].slice(0, 40);
	}

	async function loadStats() {
		try {
			const [meRes, boardRes] = await Promise.all([fetch('/api/me'), fetch('/api/leaderboard')]);
			if (meRes.ok) stats = await meRes.json();
			if (boardRes.ok) {
				const data = await boardRes.json();
				leaderboard = data.leaderboard;
			}
		} catch (err) {
			pushLog(`Failed to load stats: ${err instanceof Error ? err.message : 'unknown error'}`);
		} finally {
			loadingStats = false;
		}
	}

	onMount(() => {
		loadStats();
	});

	/**
	 * @param {Blob} blob
	 * @param {number} durationMs
	 */
	async function handleBattleSend(blob, durationMs) {
		errorMessage = '';
		pushLog(`Submitting ${(blob.size / 1024).toFixed(1)} KB clip for judging…`);
		const started = performance.now();

		try {
			const res = await fetch('/api/battle', {
				method: 'POST',
				headers: {
					'content-type': blob.type || 'audio/webm',
					'x-recording-duration-ms': String(Math.round(durationMs))
				},
				body: blob
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error || `Battle judging failed (${res.status})`);
			}

			const elapsed = Math.round(performance.now() - started);
			lastResult = { transcript: data.transcript, score: data.score };
			stats = data.stats;
			pushLog(
				`Scored ${data.points}/100 in ${elapsed}ms — rank #${data.stats.rank} of ${data.stats.totalAccounts}`
			);
			voiceRecorder?.resetAfterSend();
			loadStats();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Battle submission failed';
			errorMessage = message;
			pushLog(`Error: ${message}`);
			voiceRecorder?.markError(message);
		}
	}

	function formatTimestamp(iso) {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<main class="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
	<header class="flex items-start justify-between gap-4">
		<div>
			<a href="/" class="text-sm font-medium text-ink-muted transition hover:text-brand">← NeuSpeak</a>
			<h1 class="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">Voice Battle</h1>
		</div>
		{#if stats}
			<span class="rounded-2xl bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-dark">{stats.id}</span>
		{/if}
	</header>

	<section class="grid grid-cols-3 gap-3 rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
		<div class="flex flex-col items-center gap-0.5">
			<span class="text-2xl font-extrabold text-ink">
				{loadingStats ? '—' : `#${stats?.rank ?? '—'}`}
			</span>
			<span class="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Rank</span>
		</div>
		<div class="flex flex-col items-center gap-0.5 border-x border-cream-200">
			<span class="text-2xl font-extrabold text-brand-dark">{loadingStats ? '—' : (stats?.totalPoints ?? 0)}</span>
			<span class="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Points</span>
		</div>
		<div class="flex flex-col items-center gap-0.5">
			<span class="text-2xl font-extrabold text-ink">{loadingStats ? '—' : (stats?.battleCount ?? 0)}</span>
			<span class="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Battles</span>
		</div>
	</section>

	{#if errorMessage}
		<p class="rounded-2xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{errorMessage}</p>
	{/if}

	{#if lastResult}
		<section class="rounded-[1.75rem] bg-gradient-to-b from-brand-light to-brand p-4 text-white shadow-card sm:p-5">
			<div class="flex items-center justify-between gap-3">
				<p class="text-sm font-medium text-white/85">Last battle result</p>
				<span class="rounded-2xl bg-white/20 px-3 py-1 text-lg font-extrabold">{lastResult.score.overall}/100</span>
			</div>
			<p class="mt-3 text-sm italic text-white/90">"{lastResult.transcript}"</p>
			<p class="mt-3 text-sm font-semibold">{lastResult.score.feedback}</p>
			<div class="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-white/90">
				<div class="rounded-xl bg-white/15 py-2">Fluency {lastResult.score.fluency}</div>
				<div class="rounded-xl bg-white/15 py-2">Vocab {lastResult.score.vocabulary}</div>
				<div class="rounded-xl bg-white/15 py-2">Grammar {lastResult.score.grammar}</div>
			</div>
		</section>
	{/if}

	<VoiceRecorder bind:this={voiceRecorder} onsend={handleBattleSend} onlog={pushLog} />

	<section class="rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
		<h2 class="text-lg font-bold text-ink">Your battle history</h2>
		<div class="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
			{#if !stats || stats.history.length === 0}
				<p class="rounded-2xl border border-dashed border-cream-200 bg-cream-50 px-4 py-6 text-center text-sm text-ink-muted">
					No battles yet — record your first clip above.
				</p>
			{:else}
				{#each stats.history as item (item.id)}
					<div class="flex items-center justify-between gap-3 rounded-2xl bg-cream-50 px-3.5 py-2.5">
						<div class="min-w-0">
							<p class="truncate text-sm text-ink">"{item.transcript}"</p>
							<p class="mt-0.5 text-xs text-ink-soft">{formatTimestamp(item.createdAt)}</p>
						</div>
						<span class="shrink-0 rounded-xl bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-dark">
							{item.points} pts
						</span>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
		<h2 class="text-lg font-bold text-ink">Leaderboard</h2>
		<div class="mt-3 flex flex-col gap-1.5">
			{#if leaderboard.length === 0}
				<p class="rounded-2xl border border-dashed border-cream-200 bg-cream-50 px-4 py-6 text-center text-sm text-ink-muted">
					No scores yet — be the first!
				</p>
			{:else}
				{#each leaderboard as entry (entry.id)}
					<div
						class="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5
						{entry.id === stats?.id ? 'bg-brand-soft' : 'bg-cream-50'}"
					>
						<div class="flex items-center gap-3">
							<span class="w-6 text-sm font-extrabold text-ink-muted">#{entry.rank}</span>
							<span class="text-sm font-semibold text-ink">{entry.id}</span>
							{#if entry.id === stats?.id}
								<span class="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-white">You</span>
							{/if}
						</div>
						<div class="text-right">
							<p class="text-sm font-bold text-brand-dark">{entry.totalPoints} pts</p>
							<p class="text-[11px] text-ink-soft">{entry.battles} battles</p>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<DebugPanel {logs} />
</main>
