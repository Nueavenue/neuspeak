<!-- src/routes/signup/+page.svelte -->
<script>
	import { supabase } from '$lib/auth/supabaseClient';
	import { getAuthCallbackUrl } from '$lib/auth/redirects';
	import PasswordField from '$lib/components/PasswordField.svelte';

	const MIN_PASSWORD_LENGTH = 8;

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');
	let sentTo = $state('');

	// Live feedback while typing — never wait until submit to tell the user
	// their passwords don't match or their password is too short.
	const passwordTooShort = $derived(password.length > 0 && password.length < MIN_PASSWORD_LENGTH);
	const passwordsMatch = $derived(
		password.length > 0 && confirmPassword.length > 0 && password === confirmPassword
	);
	const passwordsMismatch = $derived(
		password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword
	);
	const canSubmit = $derived(
		email.length > 0 &&
			password.length >= MIN_PASSWORD_LENGTH &&
			confirmPassword.length > 0 &&
			password === confirmPassword &&
			!submitting
	);

	/** @param {SubmitEvent} event */
	async function handleSubmit(event) {
		event.preventDefault();
		errorMessage = '';

		if (!canSubmit) {
			if (passwordTooShort) {
				errorMessage = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
			} else if (passwordsMismatch) {
				errorMessage = 'Passwords do not match.';
			} else {
				errorMessage = 'Please fill in every field.';
			}
			return;
		}

		submitting = true;
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { emailRedirectTo: getAuthCallbackUrl('/') }
		});
		submitting = false;

		if (error) {
			errorMessage = error.message;
			return;
		}

		// If email confirmation is off, Supabase returns a session immediately
		// and there's nothing to "check email" for — send them straight in.
		if (data.session) {
			window.location.href = '/';
			return;
		}

		sentTo = email;
	}
</script>

<main
	class="max-w-md px-4 py-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full flex-col justify-center"
>
	<div class="rounded-3xl bg-white/80 p-6 shadow-soft sm:p-8">
		<h1 class="text-2xl font-extrabold text-ink">Create your account</h1>
		<p class="mt-1 text-sm text-ink-muted">Save your progress and pick up where you left off.</p>

		{#if sentTo}
			<div class="mt-6 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink" role="status">
				<p class="font-semibold">Check your email</p>
				<p class="mt-1 text-ink-muted">
					We sent a confirmation link to <span class="font-medium text-ink">{sentTo}</span>. Click
					it to activate your account, then come back and log in.
				</p>
			</div>
			<p class="mt-4 text-sm text-ink-muted text-center">
				<a href="/login" class="font-semibold text-brand hover:underline">Back to log in</a>
			</p>
		{:else}
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

				<div>
					<PasswordField
						id="password"
						label="Password"
						autocomplete="new-password"
						bind:value={password}
						minlength={MIN_PASSWORD_LENGTH}
						invalid={passwordTooShort}
					/>
					{#if passwordTooShort}
						<p class="mt-1 text-xs font-medium text-red-600">
							Password must be at least {MIN_PASSWORD_LENGTH} characters.
						</p>
					{:else}
						<p class="mt-1 text-xs text-ink-soft">At least {MIN_PASSWORD_LENGTH} characters.</p>
					{/if}
				</div>

				<div>
					<PasswordField
						id="confirm-password"
						label="Confirm password"
						autocomplete="new-password"
						bind:value={confirmPassword}
						invalid={passwordsMismatch}
					/>
					<!-- Live match feedback: never rely on color alone, always pair with text. -->
					{#if passwordsMismatch}
						<p class="mt-1 text-xs font-medium text-red-600">Passwords do not match.</p>
					{:else if passwordsMatch}
						<p class="mt-1 text-xs font-medium text-emerald-600">Passwords match.</p>
					{/if}
				</div>

				{#if errorMessage}
					<p class="rounded-2xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600" role="alert">
						{errorMessage}
					</p>
				{/if}

				<button
					type="submit"
					class="mt-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white enabled:hover:bg-brand w-full transition disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canSubmit}
				>
					{submitting ? 'Creating account…' : 'Create account'}
				</button>
			</form>

			<p class="mt-5 text-sm text-ink-muted text-center">
				Already have an account?
				<a href="/login" class="font-semibold text-brand hover:underline">Log in</a>
			</p>
		{/if}
	</div>
</main>
