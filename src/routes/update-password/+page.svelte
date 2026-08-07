<!-- src/routes/update-password/+page.svelte -->
<script>
	import { supabase } from '$lib/auth/supabaseClient';
	import PasswordField from '$lib/components/PasswordField.svelte';

	const MIN_PASSWORD_LENGTH = 8;

	let password = $state('');
	let confirmPassword = $state('');
	let submitting = $state(false);
	let errorMessage = $state('');
	let done = $state(false);

	const passwordTooShort = $derived(password.length > 0 && password.length < MIN_PASSWORD_LENGTH);
	const passwordsMatch = $derived(
		password.length > 0 && confirmPassword.length > 0 && password === confirmPassword
	);
	const passwordsMismatch = $derived(
		password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword
	);
	const canSubmit = $derived(
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
			errorMessage = passwordTooShort
				? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
				: 'Passwords do not match.';
			return;
		}

		submitting = true;
		const { error } = await supabase.auth.updateUser({ password });
		submitting = false;

		if (error) {
			errorMessage = error.message;
			return;
		}

		done = true;
	}
</script>

<main
	class="max-w-md px-4 py-10 mx-auto flex min-h-[calc(100vh-3rem)] w-full flex-col justify-center"
>
	<div class="rounded-3xl bg-white/80 p-6 shadow-soft sm:p-8">
		<h1 class="text-2xl font-extrabold text-ink">Set a new password</h1>
		<p class="mt-1 text-sm text-ink-muted">Choose something you haven't used before.</p>

		{#if done}
			<div class="mt-6 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-ink" role="status">
				<p class="font-semibold">Password updated</p>
				<p class="mt-1 text-ink-muted">You can now log in with your new password.</p>
			</div>
			<p class="mt-4 text-sm text-ink-muted text-center">
				<a href="/login" class="font-semibold text-brand hover:underline">Go to log in</a>
			</p>
		{:else}
			<form class="mt-6 gap-4 flex flex-col" onsubmit={handleSubmit}>
				<div>
					<PasswordField
						id="password"
						label="New password"
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
						label="Confirm new password"
						autocomplete="new-password"
						bind:value={confirmPassword}
						invalid={passwordsMismatch}
					/>
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
					{submitting ? 'Updating…' : 'Update password'}
				</button>
			</form>
		{/if}
	</div>
</main>
