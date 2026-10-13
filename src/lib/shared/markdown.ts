/**
 * Sehr kleines Markdown für die Rechtstexte – bewusst ohne HTML-Durchreichung,
 * damit aus dem Portal nichts Ausführbares auf die Webseite gelangt.
 *
 *   ## Überschrift / ### Unterüberschrift
 *   - Aufzählung
 *   > Hinweisbox
 *   **fett**, *kursiv*, [Text](https://…), ==noch zu ergänzen==
 *
 * Absätze trennt eine Leerzeile, ein einfacher Zeilenumbruch bleibt einer.
 * Kopie aus dem Repo Astronox-Development (src/lib/markdown.ts) – beide gleich halten.
 */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function safeHref(href: string): string | null {
	const h = href.trim();
	if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(h)) return h;
	if (/^www\./i.test(h)) return `https://${h}`;
	return null;
}

export function inline(src: string): string {
	// Links zuerst herausnehmen, damit ihr Inhalt nicht doppelt maskiert wird
	const links: string[] = [];
	let s = src.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, href: string) => {
		const url = safeHref(href);
		const label = esc(text);
		const external = url && /^https?:/i.test(url);
		links.push(url ? `<a href="${esc(url)}"${external ? ' rel="noopener"' : ''}>${label}</a>` : label);
		return `\u0000${links.length - 1}\u0000`;
	});
	s = esc(s)
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
		.replace(/==(.+?)==/g, '<span class="todo">$1</span>');
	return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => links[Number(i)]);
}

export function markdown(src: string): string {
	const out: string[] = [];
	const blocks = src.replace(/\r\n/g, '\n').split(/\n{2,}/);
	for (const raw of blocks) {
		const block = raw.trim();
		if (!block) continue;
		const lines = block.split('\n');
		// Überschrift ohne Leerzeile danach: Rest als eigener Block
		const h = /^(#{2,3})\s+(.*)$/.exec(lines[0]);
		if (h) {
			const level = h[1].length;
			out.push(`<h${level}>${inline(h[2])}</h${level}>`);
			if (lines.length > 1) out.push(markdown(lines.slice(1).join('\n')));
		} else if (lines.every((l) => /^[-*]\s+/.test(l))) {
			out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`);
		} else if (lines.every((l) => l.startsWith('>'))) {
			out.push(`<p class="notice">${lines.map((l) => inline(l.replace(/^>\s?/, ''))).join('<br />')}</p>`);
		} else {
			out.push(`<p>${lines.map(inline).join('<br />')}</p>`);
		}
	}
	return out.join('\n');
}
