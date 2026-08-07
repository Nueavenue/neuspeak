<!-- src/routes/login/+page.svelte -->
<script>
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { supabase } from '$lib/auth/supabaseClient';
	import PasswordField from '$lib/components/PasswordField.svelte';

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);

	// /auth/callback bounces here with ?error=auth_callback if an email
	// confirmation link was invalid, already used, or expired.
	let errorMessage = $state(
		page.url.searchParams.get('error') === 'auth_callback'
			? 'That confirmation link was invalid, already used, or expired. Please log in, or sign up again.'
			: ''
	);

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') || '/');

	/** @param {SubmitEvent} event */
	async function handleSubmit(event) {
		event.preventDefault();
		errorMessage = '';

		if (!email || !password) {
			errorMessage = 'Please enter both your email and password.';
			return;
		}

		submitting = true;
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		submitting = false;

		if (error) {
			errorMessage = error.message;
			return;
		}

		// Re-runs +layout.server.ts / +page.server.ts loads with the fresh
		// session cookie before navigating, so the guard on "/" doesn't
		// bounce us straight back to /login.
		await invalidate('supabase:auth');
		goto(redirectTo);
	}
</script>

<main
	class="max-w-md px-4 py-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full flex-col justify-center"
>
	<div class="rounded-3xl bg-white/80 p-6 shadow-soft sm:p-8">
		<h1 class="text-2xl font-extrabold text-ink">Log in</h1>
		<p class="mt-1 text-sm text-ink-muted">Welcome back — let's keep practicing.</p>

		<form class="mt-6 gap-4 flex flex-col" onsubmit={handleSubmit}>
			<div class="gap-1 flex flex-col">
				<label for="email" class="text-sm font-semibold text-ink">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					bind:value={email}
					class="rounded-xl border-ink/10 bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:ring-brand/20 w-full border transition outline-none focus:ring-2"
				/>
			</div>

			<PasswordField
				id="password"
				label="Password"
				autocomplete="current-password"
				bind:value={password}
			/>

			{#if errorMessage}
				<p class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600" role="alert">
					{errorMessage}
				</p>
			{/if}

			<button
				type="submit"
				class="mt-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white enabled:hover:bg-brand w-full transition disabled:cursor-not-allowed disabled:opacity-50"
				disabled={submitting}
			>
				{submitting ? 'Logging in…' : 'Log in'}
			</button>
		</form>

		<div class="mt-5 gap-1.5 text-sm text-ink-muted flex flex-col text-center">
			<p>
				Don't have an account?
				<a href="/signup" class="font-semibold text-brand hover:underline">Sign up</a>
			</p>
			<p>
				<a href="/reset-password" class="font-semibold text-brand hover:underline"
					>Forgot password?</a
				>
			</p>
		</div>
	</div>
</main>
