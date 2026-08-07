<script>
	/**
	 * @typedef {{ data: string; format: string }} AudioPayload
	 * @typedef {{ role: 'user' | 'assistant'; text: string; audio?: AudioPayload }} ChatMessage
	 */

	/** @type {{ messages: ChatMessage[] }} */
	let { messages } = $props();

	let playingIndex = $state(-1);

	/** @param {AudioPayload} audio */
	function playAudio(index, audio) {
		if (!audio?.data) return;
		const player = new Audio(`data:audio/${audio.format || 'wav'};base64,${audio.data}`);
		playingIndex = index;
		player.onended = () => {
			if (playingIndex === index) playingIndex = -1;
		};
		player.onerror = () => {
			if (playingIndex === index) playingIndex = -1;
		};
		player.play().catch(() => {
			if (playingIndex === index) playingIndex = -1;
		});
	}
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
						class="flex max-w-[80%] items-end gap-1.5 rounded-bubble px-3.5 py-2.5 text-sm leading-relaxed shadow-sm
						{message.role === 'user'
							? 'rounded-br-md bg-brand-soft text-ink'
							: 'rounded-bl-md bg-cream-100 text-ink'}"
					>
						<span>{message.text}</span>

						{#if message.role === 'assistant' && message.audio}
							<button
								type="button"
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-dark transition hover:bg-brand/25"
								onclick={() => playAudio(i, message.audio)}
								aria-label={playingIndex === i ? 'Playing coach reply' : "Play coach's voice"}
							>
								{#if playingIndex === i}
									<svg class="h-3 w-3 animate-pulse" viewBox="0 0 24 24" fill="currentColor"
										><rect x="6" y="5" width="4" height="14" rx="1" /><rect
											x="14"
											y="5"
											width="4"
											height="14"
											rx="1"
										/></svg
									>
								{:else}
									<svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"
										><path d="M8 5v14l11-7L8 5z" /></svg
									>
								{/if}
							</button>
						{/if}
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
