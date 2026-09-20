/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				/* Application chrome. Dark, recedes behind the work. */
				chrome: {
					950: '#0f141a',
					900: '#161c24',
					800: '#1e2530',
					700: '#293241',
					600: '#2e3847',
					500: '#3a4553',
					400: '#5c6878',
					300: '#7c8798',
					200: '#c3cbd6',
					100: '#e9edf2'
				},
				/* Drawing surface. Light, stays legible in daylight. */
				canvas: {
					DEFAULT: '#fbfbfc',
					raised: '#ffffff',
					line: '#e4e8ee',
					grid: '#d7dde5'
				},
				/* Text and strokes on the canvas. */
				ink: {
					900: '#101418',
					700: '#384252',
					500: '#6b7685',
					400: '#8b95a3'
				},
				accent: {
					DEFAULT: '#2f6bff',
					hover: '#1e56e6',
					/* Legible as text or icons against chrome-900/800. */
					onDark: '#8fb4ff',
					subtle: '#e8efff'
				},
				signal: {
					current: '#16a34a',
					danger: '#ef4444',
					warn: '#f59e0b',
					schematic: '#b91c1c'
				}
			},
			fontFamily: {
				sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
			},
			boxShadow: {
				panel: '0 1px 2px rgba(6, 10, 16, 0.06), 0 1px 3px rgba(6, 10, 16, 0.08)',
				raised: '0 4px 12px rgba(6, 10, 16, 0.18)',
				sheet: '0 -8px 24px rgba(6, 10, 16, 0.35)',
				accent: '0 4px 12px rgba(47, 107, 255, 0.4)'
			},
			spacing: {
				/* Minimum comfortable touch target. */
				touch: '2.75rem'
			},
			zIndex: {
				sheet: '40',
				modal: '50'
			}
		}
	},
	plugins: []
};
