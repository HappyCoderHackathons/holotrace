<script lang="ts">
	import { authClient } from '$lib/authClient';
	import { User, Mail, AtSign, Lock, AlertCircle, Loader2, ArrowLeft } from 'lucide-svelte';

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

<div class="flex min-h-[100dvh] items-center justify-center bg-chrome-900 px-4 py-10">
	<div class="w-full max-w-sm">
		<button
			class="mb-6 flex items-center gap-1.5 text-sm font-medium text-chrome-400 transition-colors hover:text-chrome-200"
			onclick={() => (location = '/')}
		>
			<ArrowLeft size={15} />
			Back to Holotrace
		</button>

		<div class="rounded-2xl border border-chrome-700 bg-chrome-800 p-6 shadow-raised sm:p-8">
			<h1 class="text-lg font-semibold text-chrome-100">Create account</h1>
			<p class="mt-1 text-sm text-chrome-400">Start digitizing your circuit sketches.</p>

			<form class="mt-6 space-y-4" onsubmit={handleRegistration}>
				<div>
					<label for="register-name" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-chrome-400">
						Display name
					</label>
					<div class="relative">
						<User size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" />
						<input
							id="register-name"
							name="name"
							autocomplete="name"
							bind:value={name}
							placeholder="Ada Lovelace"
							required
							class="w-full rounded-lg border border-chrome-600 bg-chrome-900/60 py-2.5 pl-9 pr-3 text-sm text-chrome-100 placeholder-chrome-500 outline-none transition-colors focus:border-accent"
						/>
					</div>
				</div>

				<div>
					<label for="register-email" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-chrome-400">
						Email
					</label>
					<div class="relative">
						<Mail size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" />
						<input
							id="register-email"
							name="email"
							type="email"
							autocomplete="email"
							bind:value={email}
							placeholder="you@example.com"
							required
							class="w-full rounded-lg border border-chrome-600 bg-chrome-900/60 py-2.5 pl-9 pr-3 text-sm text-chrome-100 placeholder-chrome-500 outline-none transition-colors focus:border-accent"
						/>
					</div>
				</div>

				<div>
					<label for="register-username" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-chrome-400">
						Username
					</label>
					<div class="relative">
						<AtSign size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" />
						<input
							id="register-username"
							name="username"
							autocomplete="username"
							bind:value={username}
							minlength="3"
							maxlength="30"
							placeholder="ada"
							required
							class="w-full rounded-lg border border-chrome-600 bg-chrome-900/60 py-2.5 pl-9 pr-3 text-sm text-chrome-100 placeholder-chrome-500 outline-none transition-colors focus:border-accent"
						/>
					</div>
				</div>

				<div>
					<label for="register-password" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-chrome-400">
						Password
					</label>
					<div class="relative">
						<Lock size={16} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chrome-500" />
						<input
							id="register-password"
							name="password"
							type="password"
							autocomplete="new-password"
							bind:value={password}
							minlength="12"
							placeholder="At least 12 characters"
							required
							class="w-full rounded-lg border border-chrome-600 bg-chrome-900/60 py-2.5 pl-9 pr-3 text-sm text-chrome-100 placeholder-chrome-500 outline-none transition-colors focus:border-accent"
						/>
					</div>
				</div>

				{#if errorMessage}
					<div
						class="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
						role="alert"
					>
						<AlertCircle size={15} class="mt-0.5 shrink-0" />
						<span>{errorMessage}</span>
					</div>
				{/if}

				<button
					type="submit"
					disabled={isSubmitting}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white shadow-accent transition-opacity hover:opacity-90 disabled:opacity-50"
				>
					{#if isSubmitting}
						<Loader2 size={15} class="animate-spin" />
					{/if}
					{isSubmitting ? 'Creating account…' : 'Create account'}
				</button>
			</form>

			<p class="mt-5 text-center text-sm text-chrome-400">
				Already have an account?
				<button type="button" class="font-medium text-accent hover:underline" onclick={() => (location = '/login')}>
					Log in
				</button>
			</p>
		</div>
	</div>
</div>