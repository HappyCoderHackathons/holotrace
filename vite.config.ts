import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// These are only imported on demand (OpenCV when a photo is scanned, the icons and the Tauri bridge inside modals). Left
	// to be discovered, Vite re-optimizes them the first time they load and reloads the page, which throws away a photo
	// that has just been taken. Listing them has it prepare them at startup.
	optimizeDeps: {
		include: ['opencv-ts', 'lucide-svelte', '@tauri-apps/api/core']
	},
	server: {
		host: true,
		port: 5173,
		strictPort: true,
		allowedHosts: true,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	}
});
