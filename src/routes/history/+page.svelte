<!-- src/routes/history/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import ChatLog from '$lib/components/ChatLog.svelte';

	/** @typedef {{ id: string; title: string | null; createdAt: string; updatedAt: string }} ConversationSummary */
	/** @typedef {{ id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: string }} HistoryMessage */

	let loading = $state(true);
	let error = $state('');
	/** @type {ConversationSummary[]} */
	let conversations = $state([]);

	let selectedId = $state(/** @type {string | null} */ (null));
	let detailLoading = $state(false);
	let detailError = $state('');
	/** @type {HistoryMessage[]} */
	let detailMessages = $state([]);

	// ChatLog only knows about user/assistant bubbles (see
	// src/lib/components/ChatLog.svelte) — system/debug rows are saved but
	// intentionally not shown here yet.
	const chatLogMessages = $derived(
		detailMessages
			.filter((m) => m.role !== 'system')
			.map((m) => ({ role: m.role, text: m.content }))
	);

	async function loadConversations() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/conversations');
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			conversations = data.conversations ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not load your conversation history.';
		} finally {
			loading = false;
		}
	}

	/** @param {string} id */
	async function selectConversation(id) {
		selectedId = id;
		detailLoading = true;
		detailError = '';
		detailMessages = [];
		try {
			const res = await fetch(`/api/conversations/${id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
			detailMessages = data.messages ?? [];
		} catch (err) {
			detailError = err instanceof Error ? err.message : 'Could not load this conversation.';
		} finally {
			detailLoading = false;
		}
	}

	/** @param {string} iso */
	function formatDate(iso) {
		return new Date(iso).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	onMount(loadConversations);
</script>

<main class="max-w-3xl gap-5 px-4 py-6 sm:px-6 sm:py-8 mx-auto flex min-h-screen w-full flex-col">
	<div>
		<p class="text-sm font-medium text-ink-muted">Your progress</p>
		<h1 class="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
			Conversation history
		</h1>
	</div>

	<div class="gap-5 sm:grid-cols-[220px_1fr] grid">
		<section class="bg-white p-3 shadow-soft sm:p-4 rounded-[1.75rem]">
			<h2 class="mb-2 px-1 text-sm font-bold text-ink">Sessions</h2>

			{#if loading}
				<p class="px-1 text-sm text-ink-soft">Loading…</p>
			{:else if error}
				<p class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
			{:else if conversations.length === 0}
				<p class="px-1 text-sm text-ink-soft">
					No conversations yet — start one from the home page.
				</p>
			{:else}
				<ul class="gap-1 flex flex-col">
					{#each conversations as c (c.id)}
						<li>
							<button
								type="button"
								class="rounded-2xl px-3 py-2 text-sm w-full text-left transition {selectedId ===
								c.id
									? 'bg-brand-soft font-semibold text-brand-dark'
									: 'text-ink hover:bg-cream-100'}"
								onclick={() => selectConversation(c.id)}
							>
								<span class="block truncate">{c.title || formatDate(c.createdAt)}</span>
								<span class="text-xs text-ink-soft block">{formatDate(c.updatedAt)}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="min-h-[24rem]">
			{#if !selectedId}
				<div
					class="gap-1 bg-white/80 p-4 shadow-soft sm:p-5 flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[1.75rem] text-center"
				>
					<p class="text-sm font-medium text-ink-muted">Select a session</p>
					<p class="text-xs text-ink-soft">Pick one from the list to see its messages.</p>
				</div>
			{:else if detailLoading}
				<div class="bg-white/80 p-4 text-sm text-ink-soft shadow-soft sm:p-5 rounded-[1.75rem]">
					Loading conversation…
				</div>
			{:else if detailError}
				<div class="bg-white/80 p-4 shadow-soft sm:p-5 rounded-[1.75rem]">
					<p class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
						{detailError}
					</p>
				</div>
			{:else}
				<ChatLog messages={chatLogMessages} />
			{/if}
		</div>
	</div>
</main>
