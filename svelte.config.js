import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes mode for first-party components; leave node_modules libraries in legacy mode.
		// Can be dropped in Svelte 6, where runes are the default everywhere.
		runes: ({ filename }) => (filename.includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto
		// for a list. Switch to a specific adapter once the deployment target is settled.
		adapter: adapter()
	}
};

export default config;
