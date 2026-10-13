import type { Choice } from '$lib/shared/settings';
import { act, bad } from '$lib/server/forms';
import { getSetting, setSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ anfrage: await getSetting('anfrage') });

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/€/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40) || 'option';

/** Kennungen bleiben, damit alte Anfragen ihre Bezeichnung behalten; neue bekommen eine aus dem Text */
function normalize(list: unknown, name: string): Choice[] {
	if (!Array.isArray(list)) return bad(`${name}: ungültige Daten`);
	const used = new Set<string>();
	const out: Choice[] = [];
	for (const raw of list as Choice[]) {
		const label = String(raw.label ?? '').trim().slice(0, 80);
		if (!label) continue;
		let id = String(raw.id ?? '').trim() || slug(label);
		while (used.has(id)) id = `${id}-2`;
		used.add(id);
		out.push({ id, label, ...(raw.hint?.trim() ? { hint: raw.hint.trim().slice(0, 120) } : {}) });
	}
	if (!out.length) bad(`${name}: mindestens eine Auswahl ist nötig.`);
	return out;
}

export const actions: Actions = {
	default: act(async (_e, f) => {
		let v: { projectTypes: unknown; budgets: unknown; timeframes: unknown };
		try {
			v = JSON.parse(f.str('value', 50_000) ?? '{}');
		} catch {
			return bad('Die Eingaben konnten nicht gelesen werden.');
		}
		await setSetting('anfrage', {
			projectTypes: normalize(v.projectTypes, 'Projektart'),
			budgets: normalize(v.budgets, 'Budget'),
			timeframes: normalize(v.timeframes, 'Zeitrahmen')
		});
		return { message: 'Gespeichert – das Formular auf der Webseite zeigt die neue Auswahl' };
	})
};
