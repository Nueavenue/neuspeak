<script>
	import { onMount } from 'svelte';

	/**
	 * THROWAWAY page — proves Supabase read/write works end-to-end from the
	 * browser through our server route. Delete this page (and
	 * src/routes/api/test-db, supabase/sql/000_test_events.sql) once you've
	 * confirmed connectivity.
	 * @typedef {{ id: string; message: string; created_at: string }} Row
	 */

	let loading = $state(true);
	/** @type {string} */
	let error = $state('');
	/** @type {Row[]} */
	let rows = $state([]);

	async function loadRows() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/test-db');
			const data = await res.json();
			if (!res.ok) throw new Error(data?.detail || data?.error || `HTTP ${res.status}`);
			rows = data.rows ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Request failed';
		} finally {
			loading = false;
		}
	}

	onMount(loadRows);
</script>

<main class="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 px-4 py-8">
	<div>
		<h1 class="text-xl font-bold text-ink">Supabase connectivity test</h1>
		<p class="mt-1 text-sm text-ink-soft">
			Throwaway page — on load, writes one row to <code>test_events</code> and reads the last 5
			back. Run <code>supabase/sql/000_test_events.sql</code> in the Supabase SQL Editor first.
		</p>
	</div>

	<button
		type="button"
		class="w-fit rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white transition enabled:hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50"
		disabled={loading}
		onclick={loadRows}
	>
		{loading ? 'Running…' : 'Insert + reload'}
	</button>

	{#if error}
		<p class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
	{:else if loading}
		<p class="text-sm text-ink-soft">Loading…</p>
	{:else if rows.length === 0}
		<p class="text-sm text-ink-soft">No rows yet.</p>
	{:else}
		<div class="rounded-2xl bg-cream-50 px-3 py-2 text-sm text-ink">
			<p class="mb-1 font-semibold">Last {rows.length} row(s):</p>
			<ul class="flex flex-col gap-1">
				{#each rows as row (row.id)}
					<li class="font-mono text-xs text-ink-soft">
						{row.message} · {new Date(row.created_at).toLocaleTimeString()}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</main>
