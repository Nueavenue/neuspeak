/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				cream: {
					50: '#FFFBF7',
					100: '#F8F3EC',
					200: '#F0E7DB'
				},
				ink: {
					DEFAULT: '#1C1917',
					muted: '#78716C',
					soft: '#A8A29E'
				},
				brand: {
					DEFAULT: '#FF8A1F',
					dark: '#F07300',
					light: '#FFB45C',
					soft: '#FFF1E0'
				}
			},
			fontFamily: {
				sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif']
			},
			boxShadow: {
				soft: '0 10px 30px rgba(28, 25, 23, 0.06)',
				card: '0 16px 40px rgba(255, 138, 31, 0.18)'
			},
			borderRadius: {
				bubble: '1.5rem'
			}
		}
	},
	plugins: []
};
