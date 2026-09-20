import { createAuthClient } from 'better-auth/svelte';
import { usernameClient } from 'better-auth/client/plugins';

const DEFAULT_AUTH_BASE_URL = 'https://api.ifyousmellityouwilleventuallydie.tech';

export const authBaseURL = import.meta.env.PUBLIC_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL;

export const authClient = createAuthClient({
	baseURL: authBaseURL,
	fetchOptions: {
		credentials: 'include'
	},
	plugins: [usernameClient()]
});
