/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				surface: {
					50: '#fafbfc',
					100: '#f4f6f8',
					200: '#e8ecf0',
					300: '#d6dde3'
				},
				accent: {
					DEFAULT: '#2563eb',
					dark: '#1d4ed8',
					light: '#dbeafe'
				},
				ink: {
					900: '#1a2027',
					700: '#3d4650',
					500: '#6b7684',
					300: '#9aa5b1'
				},
				live: {
					DEFAULT: '#16a34a',
					light: '#dcfce7'
				},
				schematic: '#b91c1c'
			},
			fontFamily: {
				sans: [
					'Inter',
					'-apple-system',
					'BlinkMacSystemFont',
					'Segoe UI',
					'sans-serif'
				],
				mono: ['JetBrains Mono', 'ui-monospace', 'monospace']
			},
			boxShadow: {
				panel: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
				toolbar: '0 1px 0 rgba(16, 24, 40, 0.06)'
			}
		}
	},
	plugins: []
};
