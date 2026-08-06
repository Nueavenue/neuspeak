<script>
	/**
	 * @typedef {{ role: 'user' | 'assistant'; text: string }} ChatMessage
	 */

	/** @type {{ messages: ChatMessage[] }} */
	let { messages } = $props();
</script>

<section class="rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-5">
	<div class="mb-4 flex items-end justify-between gap-3">
		<div>
			<h2 class="text-lg font-bold text-ink">Conversation</h2>
			<p class="mt-0.5 text-sm text-ink-muted">Speak freely — the coach replies in the chat log.</p>
		</div>
		<span class="rounded-2xl bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
			{messages.length} messages
		</span>
	</div>

	<div class="flex max-h-80 min-h-48 flex-col gap-3 overflow-y-auto pr-1">
		{#if messages.length === 0}
			<div
				class="flex flex-1 flex-col items-center justify-center rounded-bubble border border-dashed border-cream-200 bg-cream-50 px-4 py-10 text-center"
			>
				<p class="text-sm font-medium text-ink-muted">No messages yet</p>
				<p class="mt-1 text-xs text-ink-soft">Start a conversation, then send a practice line.</p>
			</div>
		{:else}
			{#each messages as message, i (i)}
				<div class="flex items-end gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					{#if message.role === 'assistant'}
						<div
							class="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
						>
							AI
						</div>
					{/if}

					<div
						class="max-w-[80%] rounded-bubble px-3.5 py-2.5 text-sm leading-relaxed shadow-sm
						{message.role === 'user'
							? 'rounded-br-md bg-brand-soft text-ink'
							: 'rounded-bl-md bg-cream-100 text-ink'}"
					>
						{message.text}
					</div>

					{#if message.role === 'user'}
						<div
							class="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
						>
							You
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</section>
