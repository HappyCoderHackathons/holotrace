import { createAuthClient } from 'better-auth/svelte';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: import.meta.env.PUBLIC_AUTH_BASE_URL ?? import.meta.env.PUBLIC_API_BASE_URL,
	fetchOptions: {
		credentials: 'include'
	},
	plugins: [usernameClient()]
});
