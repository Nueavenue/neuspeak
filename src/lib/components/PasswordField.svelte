<!-- src/lib/components/PasswordField.svelte -->
<script>
	/**
	 * Reusable password input with a keyboard-accessible show/hide toggle.
	 * Used by /login, /signup, and /update-password so the eye-icon
	 * behavior and styling stay identical everywhere.
	 *
	 * @type {{
	 *   id: string,
	 *   label: string,
	 *   value: string,
	 *   autocomplete?: string,
	 *   placeholder?: string,
	 *   required?: boolean,
	 *   minlength?: number,
	 *   invalid?: boolean
	 * }}
	 */
	let {
		id,
		label,
		value = $bindable(''),
		autocomplete = 'current-password',
		placeholder = '',
		required = true,
		minlength = undefined,
		invalid = false
	} = $props();

	let visible = $state(false);
</script>

<div class="gap-1 flex flex-col">
	<label for={id} class="text-sm font-semibold text-ink">{label}</label>
	<div class="relative">
		<input
			{id}
			name={id}
			type={visible ? 'text' : 'password'}
			bind:value
			{autocomplete}
			{placeholder}
			{required}
			{minlength}
			aria-invalid={invalid}
			class="rounded-xl bg-white px-3 py-2.5 pr-11 text-sm text-ink w-full border transition outline-none focus:ring-2 {invalid
				? 'border-red-400 focus:border-red-400 focus:ring-red-200'
				: 'border-ink/10 focus:border-brand focus:ring-brand/20'}"
		/>
		<button
			type="button"
			class="inset-y-0 right-2 px-1 text-ink-soft hover:text-ink absolute flex items-center transition"
			aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
			aria-pressed={visible}
			onclick={() => (visible = !visible)}
		>
			{#if visible}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
					/>
					<line x1="1" y1="1" x2="23" y2="23" />
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
			{/if}
		</button>
	</div>
</div>
