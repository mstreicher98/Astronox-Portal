/**
 * Ziel nach dem Anmelden (?ziel=…): nur Pfade im Portal. Browser lesen „//…“, „/\…“ oder
 * Tabs im Pfad als fremde Adresse – daher wie der Browser auflösen und den Ursprung prüfen.
 */
export function safeTarget(t: string | null): string {
	if (!t || !t.startsWith('/')) return '/';
	const base = 'https://portal.invalid';
	try {
		const u = new URL(t, base);
		return u.origin === base ? `${u.pathname}${u.search}${u.hash}` : '/';
	} catch {
		return '/';
	}
}
