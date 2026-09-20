<script lang="ts">
    let name = $state<string>("");
    let password = $state<string>("");

    let { location = $bindable("") } = $props();

    function gotoHome() {
        location = "/"
    }

    async function handleLogin() {

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
                type="username"
                class="form-control"
                id="name"
                bind:value={name}
                placeholder="Enter Username or Email"
                required
            />
        </div>

        <div class="mb-3">
            <label for="password" class="form-label">Password</label>
            <input
                type="password"
                class="form-control"
                id="password"
                bind:value={password}
                placeholder="Password"
                required
            />
        </div>

        <button type="submit" class="btn btn-primary w-100">Login</button>

        <div class="mt-3 text-center">
            <a href="/register">Don't have an account? Sign up</a>
        </div>
    </form>
</div>
