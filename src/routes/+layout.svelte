<!-- src/routes/+layout.svelte -->
<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { supabase } from '$lib/auth/supabaseClient';

	let { data, children } = $props();

	// Keeps every server load's `session`/`user` (from +layout.server.ts) in
	// sync with whatever the browser client thinks the session is — so
	// logging in/out anywhere in the app updates this nav without a full
	// page reload. See docs/api-architecture.md → "Authentication" section.
	onMount(() => {
		const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.access_token !== data.session?.access_token) {
				invalidate('supabase:auth');
			}
		});
		return () => listener.subscription.unsubscribe();
	});

	let loggingOut = $state(false);

	async function logOut() {
		loggingOut = true;
		await supabase.auth.signOut();
		await invalidate('supabase:auth');
		loggingOut = false;
		window.location.href = '/';
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="border-ink/5 bg-cream-50/80 border-b">
	<nav class="max-w-3xl px-4 py-2.5 text-sm mx-auto flex items-center justify-between">
		<a href="/" class="font-bold text-ink">NeuSpeak</a>

		{#if data.user}
			<div class="gap-3 flex items-center">
				<a href="/history" class="font-semibold text-ink-muted hover:text-ink transition">History</a
				>
				<span class="text-ink-muted sm:inline hidden">{data.user.email}</span>
				<button
					type="button"
					class="rounded-xl px-3 py-1.5 font-semibold text-ink-muted enabled:hover:bg-ink/5 transition disabled:opacity-50"
					disabled={loggingOut}
					onclick={logOut}
				>
					{loggingOut ? 'Logging out…' : 'Log out'}
				</button>
			</div>
		{:else}
			<div class="gap-2 flex items-center">
				<a
					href="/login"
					class="rounded-xl px-3 py-1.5 font-semibold text-ink-muted hover:bg-ink/5 transition"
				>
					Log in
				</a>
				<a
					href="/signup"
					class="rounded-xl bg-ink px-3 py-1.5 font-semibold text-white hover:bg-brand transition"
				>
					Sign up
				</a>
			</div>
		{/if}
	</nav>
</div>

{@render children()}
