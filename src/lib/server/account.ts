// Chars chosen to avoid visually ambiguous characters (0/O, 1/I) since this ID
// is shown to users and might be typed/read aloud.
const DISPLAY_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateDisplayId(): string {
	let suffix = '';
	for (let i = 0; i < 8; i++) {
		suffix += DISPLAY_ID_CHARS[Math.floor(Math.random() * DISPLAY_ID_CHARS.length)];
	}
	return `NS-${suffix}`;
}
