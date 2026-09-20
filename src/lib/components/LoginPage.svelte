<script lang="ts">
    import { authClient } from '$lib/authClient';

    let username = $state('');
    let password = $state('');
    let errorMessage = $state('');
    let isSubmitting = $state(false);

    let { location = $bindable('') } = $props();

    function gotoHome() {
        location = '/';
    }

    async function handleLogin(event: SubmitEvent) {
        event.preventDefault();
        errorMessage = '';
        isSubmitting = true;

        try {
            const result = await authClient.signIn.username({ username, password });

            if (result.error) {
                errorMessage = result.error.message ?? 'Unable to sign in.';
                return;
            }

            password = '';
            gotoHome();
        } catch {
            errorMessage = 'Unable to reach the authentication service.';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<button
    class="flex items-center gap-1.5 rounded-lg border border-chrome-600 px-3.5 py-2 text-sm font-medium text-chrome-200 transition-colors hover:bg-chrome-700"
    onclick={gotoHome}
>
    Home
</button>

<div class="d-flex justify-content-center align-items-center">
    <form
        id="dataForm"
        class="p-4 shadow rounded"
        style="width: 100%; max-width: 400px;"
        onsubmit={handleLogin}
    >
        <h2 class="mb-4 text-center">Login</h2>

        <div class="mb-3">
            <label for="name" class="form-label">Username</label>
            <input
                type="text"
                class="form-control"
                id="username"
                name="username"
                autocomplete="username"
                bind:value={username}
                placeholder="Enter username"
                required
            />
        </div>

        <div class="mb-3">
            <label for="password" class="form-label">Password</label>
            <input
                type="password"
                class="form-control"
                id="password"
                name="password"
                autocomplete="current-password"
                bind:value={password}
                placeholder="Password"
                required
            />
        </div>

        {#if errorMessage}
            <p class="mt-3 text-sm text-red-400" role="alert">{errorMessage}</p>
        {/if}

        <button type="submit" class="btn btn-primary w-100" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Login'}
        </button>

        <div class="mt-3 text-center">
            <button type="button" class="text-accent hover:underline" onclick={() => location = '/register'}>
                Don't have an account? Sign up
            </button>
        </div>
    </form>
</div>
