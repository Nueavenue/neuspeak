<!-- src/lib/components/HeaderStatus.svelte -->
<script>
	import { SESSION_STATE_LABELS } from '$lib/session';

	/** @typedef {import('$lib/session').SessionState} SessionState */

	/** @type {{ title?: string, state: SessionState }} */
	let { title = 'NeuSpeak', state } = $props();

	const states = /** @type {SessionState[]} */ (['idle', 'connecting', 'connected', 'disconnected', 'error']);

	/** Short strip labels — keep one full line in the EC iframe. */
	const SHORT = /** @type {Record<SessionState, string>} */ ({
		idle: 'Idle',
		mic: 'Mic',
		connecting: 'Conn',
		connected: 'Live',
		sending: 'Send',
		disconnecting: 'End',
		disconnected: 'Off',
		error: 'Err'
	});

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
		if (displayState !== key) {
			return 'ns-status-idle bg-transparent text-ink border border-ink/40';
		}
		if (state === 'error') return 'ns-status-on bg-red-500 text-white border border-red-500';
		if (state === 'connected' || state === 'sending') {
			return 'ns-status-on bg-brand text-ink border border-brand';
		}
		if (state === 'disconnecting') return 'ns-status-on bg-amber-500 text-white border border-amber-500';
		return 'ns-status-on bg-ink text-white border border-ink';
	}

	function labelFor(key) {
		const full = key === displayState ? SESSION_STATE_LABELS[state] : SESSION_STATE_LABELS[key];
		const short = key === displayState ? SHORT[state] : SHORT[key];
		return { short, full };
	}
</script>

<header class="ns-status-header flex flex-col gap-2.5">
	<div class="min-w-0">
		<p class="text-sm font-medium text-ink-muted">English speaking coach</p>
		<h1 class="mt-0.5 text-xl font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h1>
	</div>

	<!-- Own full-width row — never clip Idle under the title. -->
	<div
		class="ns-status-strip flex w-full flex-nowrap items-center gap-1.5 overflow-visible"
		aria-live="polite"
	>
		{#each states as key}
			{@const labels = labelFor(key)}
			<span
				class="ns-status-pill box-border inline-flex shrink-0 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide leading-none whitespace-nowrap transition {badgeClass(key)}"
				title={labels.full}
			>
				{labels.short}
			</span>
		{/each}
	</div>
</header>
