/** Themes for NeuSpeak — cream (standalone) or osneu (Seat Face embed). */
export type NeuSpeakTheme = 'cream' | 'osneu'

export const THEME_STORAGE_KEY = 'neuspeak.theme'

export function resolveTheme(search = typeof window !== 'undefined' ? window.location.search : ''): NeuSpeakTheme {
	const params = new URLSearchParams(search)
	const fromUrl = params.get('theme')
	if (fromUrl === 'osneu' || fromUrl === 'cream') return fromUrl
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY)
		if (stored === 'osneu' || stored === 'cream') return stored
	} catch {
		/* private */
	}
	if (params.get('embed') === 'osneu') return 'osneu'
	return 'cream'
}

export function applyTheme(theme: NeuSpeakTheme) {
	if (typeof document === 'undefined') return
	document.documentElement.dataset.theme = theme
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme)
	} catch {
		/* private */
	}
}
