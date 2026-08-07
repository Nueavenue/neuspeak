<!-- src/routes/reset-password/+page.svelte -->
<script>
	import { page } from '$app/state';
	import { supabase } from '$lib/auth/supabaseClient';
	import { getAuthCallbackUrl } from '$lib/auth/redirects';

	let email = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');
	let sentTo = $state('');

	// /update-password redirects back here with ?expired=1 if the recovery
	// link was invalid, already used, or expired.
	const linkExpired = page.url.searchParams.get('expired') === '1';

	/** @param {SubmitEvent} event */
	async function handleSubmit(event) {
		event.preventDefault();
		errorMessage = '';

		if (!email) {
			errorMessage = 'Please enter your email.';
			return;
		}

		submitting = true;
		// After the user clicks the emailed link, Supabase redirects here via
		// /auth/callback (which exchanges the code for a recovery session) and
		// then on to /update-password to actually set the new password.
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: getAuthCallbackUrl('/update-password')
		});
		submitting = false;

		if (error) {
			errorMessage = error.message;
			return;
		}

		sentTo = email;
	}
</script>

<main
	class="max-w-md px-4 py-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full flex-col justify-center"
>
	<div class="rounded-3xl bg-white/80 p-6 shadow-soft sm:p-8">
		<h1 class="text-2xl font-extrabold text-ink">Reset your password</h1>
		<p class="mt-1 text-sm text-ink-muted">We'll email you a link to set a new one.</p>

		{#if sentTo}
			<div class="mt-6 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink" role="status">
				<p class="font-semibold">Check your email</p>
				<p class="mt-1 text-ink-muted">
					If an account exists for <span class="font-medium text-ink">{sentTo}</span>, a reset link
					is on its way.
				</p>
			</div>
			<p class="mt-4 text-sm text-ink-muted text-center">
				<a href="/login" class="font-semibold text-brand hover:underline">Back to log in</a>
			</p>
		{:else}
			{#if linkExpired}
				<p
					class="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700"
					role="alert"
				>
					That reset link was invalid, already used, or expired. Request a new one below.
				</p>
			{/if}

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
					{submitting ? 'Sending…' : 'Send reset link'}
				</button>
			</form>

			<p class="mt-5 text-sm text-ink-muted text-center">
				<a href="/login" class="font-semibold text-brand hover:underline">Back to log in</a>
			</p>
		{/if}
	</div>
</main>
