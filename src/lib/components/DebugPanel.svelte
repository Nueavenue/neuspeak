<script>
	/** @type {{ logs: string[] }} */
	let { logs } = $props();
</script>

<section
	class="rounded-[1.75rem] border border-white/60 bg-white/70 p-4 shadow-soft backdrop-blur-md sm:p-5"
>
	<div class="mb-3 flex items-center justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold text-ink">Debug</h2>
			<p class="mt-0.5 text-sm text-ink-muted">Events, timings, and errors</p>
		</div>
		<span class="rounded-2xl bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-muted">
			{logs.length}
		</span>
	</div>

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
