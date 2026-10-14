import { tick } from 'svelte';

/** Platzhalter an der Schreibmarke einfügen; {{details}} und {{knopf}} als eigener Absatz */
export async function insertAt(area: HTMLTextAreaElement | undefined, value: string, field: string, set: (v: string) => void) {
	const block = field === 'details' || field === 'knopf';
	const token = block ? `\n\n{{${field}}}\n\n` : `{{${field}}}`;
	const a = area?.selectionStart ?? value.length;
	const b = area?.selectionEnd ?? value.length;
	set(value.slice(0, a) + token + value.slice(b));
	await tick();
	area?.focus();
	area?.setSelectionRange(a + token.length, a + token.length);
}
