<!-- src/lib/components/HeaderStatus.svelte -->
<script>
	import { SESSION_STATE_LABELS } from '$lib/session';

	/** @typedef {import('$lib/session').SessionState} SessionState */

	/** @type {{ title?: string, state: SessionState }} */
	let { title = 'NeuSpeak', state } = $props();

	// Shown compactly in the header — the full lifecycle also includes 'mic',
	// 'sending', and 'disconnecting', which are transient enough that the
	// debug panel (with timestamps) is a better place to see them tick by.
	const states = /** @type {SessionState[]} */ (['idle', 'connecting', 'connected', 'disconnected', 'error']);

	// If the live state is one of the transient ones not shown in the strip
	// above (mic/sending/disconnecting), fold it visually into its nearest
	// neighbor so the badge row still highlights *something* relevant.
	const displayState = $derived(
		state === 'mic'
			? 'connecting'
			: state === 'sending'
				? 'connected'
				: state === 'disconnecting'
					? 'disconnected'
					: state
	);

	function badgeClass(key) {
		if (displayState !== key) return 'bg-white/70 text-ink-soft';
		if (state === 'error') return 'bg-red-500 text-white shadow-soft';
		if (state === 'connected' || state === 'sending') return 'bg-brand text-white shadow-soft';
		if (state === 'disconnecting') return 'bg-amber-500 text-white shadow-soft';
		return 'bg-ink text-white shadow-soft';
	}
</script>

<header class="flex items-start justify-between gap-4">
	<div>
		<p class="text-sm font-medium text-ink-muted">English speaking coach</p>
		<h1 class="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
	</div>

	<div class="flex max-w-[58%] flex-wrap justify-end gap-1.5" aria-live="polite">
		{#each states as key}
			<span class="rounded-2xl px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition {badgeClass(key)}">
				{key === displayState ? SESSION_STATE_LABELS[state] : SESSION_STATE_LABELS[key]}
			</span>
		{/each}
	</div>
</header>
