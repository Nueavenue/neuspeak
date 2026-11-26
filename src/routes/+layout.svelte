<!-- src/routes/+layout.svelte -->
<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/auth/supabaseClient';
	import { applyTheme, resolveTheme } from '$lib/theme';

	let { data, children } = $props();

	/** @type {import('$lib/theme').NeuSpeakTheme} */
	let theme = $state('cream');
	let themeMenu = $state(false);
	let embed = $state(false);

	onMount(() => {
		const next = resolveTheme(window.location.search);
		theme = next;
		applyTheme(next);
		const params = new URLSearchParams(window.location.search);
		embed = params.get('embed') === 'osneu';
		if (embed) document.documentElement.dataset.embed = 'osneu';
		// English Conversation product — force English document language in embed.
		if (params.get('lang') === 'en' || embed) {
			document.documentElement.lang = 'en';
		}

		const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.access_token !== data.session?.access_token) {
				invalidate('supabase:auth');
			}
		});

		/** @param {MessageEvent} ev */
		function onMessage(ev) {
			const msg = ev.data;
			if (!msg || msg.type !== 'osneu-ec-theme') return;
			if (msg.theme !== 'osneu' && msg.theme !== 'cream') return;
			theme = msg.theme;
			applyTheme(msg.theme);
		}
		window.addEventListener('message', onMessage);

		return () => {
			listener.subscription.unsubscribe();
			window.removeEventListener('message', onMessage);
		};
	});

	$effect(() => {
		const q = $page.url.searchParams;
		const fromUrl = q.get('theme');
		if (fromUrl === 'osneu' || fromUrl === 'cream') {
			theme = fromUrl;
			applyTheme(fromUrl);
		}
		embed = q.get('embed') === 'osneu';
		if (embed) document.documentElement.dataset.embed = 'osneu';
		else delete document.documentElement.dataset.embed;
	});

	let loggingOut = $state(false);

	async function logOut() {
		loggingOut = true;
		await supabase.auth.signOut();
		await invalidate('supabase:auth');
		loggingOut = false;
		window.location.href = '/';
	}

	/** @param {import('$lib/theme').NeuSpeakTheme} next */
	function setTheme(next) {
		theme = next;
		applyTheme(next);
		themeMenu = false;
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="ns-chrome border-ink/5 bg-cream-50/80 border-b">
	<nav class="max-w-3xl px-4 py-2.5 text-sm mx-auto flex items-center justify-between gap-2">
		<a href="/?embed={embed ? 'osneu' : ''}&theme={theme}" class="font-bold text-ink shrink-0"
			>NeuSpeak</a
		>

		<div class="gap-2 flex items-center shrink-0">
			<div class="relative">
				<button
					type="button"
					class="rounded-xl px-2.5 py-1.5 font-semibold text-ink-muted hover:bg-ink/5 transition"
					aria-label="Theme"
					aria-expanded={themeMenu}
					onclick={() => (themeMenu = !themeMenu)}
				>
					◐
				</button>
				{#if themeMenu}
					<div
						class="absolute right-0 top-full z-20 mt-1 min-w-[9.5rem] rounded-xl border border-ink/10 bg-cream-50 p-1 shadow-soft"
						role="menu"
					>
						<button
							type="button"
							class="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-ink/5 {theme ===
							'osneu'
								? 'bg-ink/5'
								: ''}"
							onclick={() => setTheme('osneu')}
						>
							os.neu dark
						</button>
						<button
							type="button"
							class="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-ink/5 {theme ===
							'cream'
								? 'bg-ink/5'
								: ''}"
							onclick={() => setTheme('cream')}
						>
							Cream light
						</button>
					</div>
				{/if}
			</div>

			{#if data.user}
				<a href="/history" class="font-semibold text-ink-muted hover:text-ink transition sm:inline hidden"
					>History</a
				>
				<button
					type="button"
					class="rounded-xl px-3 py-1.5 font-semibold text-ink-muted enabled:hover:bg-ink/5 transition disabled:opacity-50"
					disabled={loggingOut}
					onclick={logOut}
				>
					{loggingOut ? '…' : 'Log out'}
				</button>
			{:else}
				<a
					href="/login"
					class="rounded-xl px-3 py-1.5 font-semibold text-ink-muted hover:bg-ink/5 transition"
				>
					Log in
				</a>
				<a
					href="/signup"
					class="rounded-xl bg-ink px-3 py-1.5 font-semibold text-white hover:bg-brand transition sm:inline hidden"
				>
					Sign up
				</a>
			{/if}
		</div>
	</nav>
</div>

{@render children()}
