import { createAuthClient } from 'better-auth/svelte';
import { usernameClient } from 'better-auth/client/plugins';

const DEFAULT_AUTH_BASE_URL = 'https://api.ifyousmellityouwilleventuallydie.tech';

export const authClient = createAuthClient({
	baseURL: import.meta.env.PUBLIC_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL,
	fetchOptions: {
		credentials: 'include'
	},
	plugins: [usernameClient()]
});
