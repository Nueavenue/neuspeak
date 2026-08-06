<script>
	/**
	 * @typedef {'idle' | 'mic' | 'connecting' | 'ready' | 'error'} ConnState
	 */

	/** @type {{ title?: string, state: ConnState }} */
	let { title = 'NeuSpeak', state } = $props();

	const labels = {
		idle: 'Idle',
		mic: 'Mic',
		connecting: 'Connecting',
		ready: 'Ready',
		error: 'Error'
	};

	const states = /** @type {ConnState[]} */ (['idle', 'mic', 'connecting', 'ready', 'error']);
</script>

<header class="flex items-start justify-between gap-4">
	<div>
		<p class="text-sm font-medium text-ink-muted">English speaking coach</p>
		<h1 class="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
	</div>

	<div class="flex max-w-[58%] flex-wrap justify-end gap-1.5" aria-live="polite">
		{#each states as key}
			<span
				class="rounded-2xl px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition
				{state === key
					? key === 'error'
						? 'bg-red-500 text-white shadow-soft'
						: key === 'ready'
							? 'bg-brand text-white shadow-soft'
							: 'bg-ink text-white shadow-soft'
					: 'bg-white/70 text-ink-soft'}"
			>
				{labels[key]}
			</span>
		{/each}
	</div>
</header>
