<script lang="ts">
	import { authClient } from '$lib/authClient';

	let name = $state('');
	let email = $state('');
	let username = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let isSubmitting = $state(false);

	let { location = $bindable('') } = $props();

	async function handleRegistration(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		isSubmitting = true;

		try {
			const result = await authClient.signUp.email({
				name,
				email,
				username,
				password
			});

			if (result.error) {
				errorMessage = result.error.message ?? 'Unable to create the account.';
				return;
			}

			password = '';
			location = '/';
		} catch {
			errorMessage = 'Unable to reach the authentication service.';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<button
	class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
	onclick={() => location = '/'}
>
	Home
</button>

<div class="d-flex justify-content-center align-items-center">
	<form
		class="p-4 shadow rounded"
		style="width: 100%; max-width: 400px;"
		onsubmit={handleRegistration}
	>
		<h2 class="mb-4 text-center">Create account</h2>

		<label for="register-name" class="form-label">Display name</label>
		<input id="register-name" name="name" class="form-control mb-3" autocomplete="name" bind:value={name} required />

		<label for="register-email" class="form-label">Email</label>
		<input id="register-email" name="email" type="email" class="form-control mb-3" autocomplete="email" bind:value={email} required />

		<label for="register-username" class="form-label">Username</label>
		<input id="register-username" name="username" class="form-control mb-3" autocomplete="username" bind:value={username} minlength="3" maxlength="30" required />

		<label for="register-password" class="form-label">Password</label>
		<input id="register-password" name="password" type="password" class="form-control" autocomplete="new-password" bind:value={password} minlength="12" required />

		{#if errorMessage}
			<p class="mt-3 text-sm text-red-400" role="alert">{errorMessage}</p>
		{/if}

		<button type="submit" class="btn btn-primary mt-3 w-100" disabled={isSubmitting}>
			{isSubmitting ? 'Creating account…' : 'Create account'}
		</button>

		<div class="mt-3 text-center">
			<button type="button" class="text-accent hover:underline" onclick={() => location = '/login'}>
				Already have an account? Log in
			</button>
		</div>
	</form>
</div>
