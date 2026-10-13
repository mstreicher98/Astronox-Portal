import { error } from '@sveltejs/kit';
import { SECTIONS } from '$lib/shared/site';
import { act, bad } from '$lib/server/forms';
import { discard, isKey, loadSection, previewUrl, publish, saveDraft } from '$lib/server/website';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!isKey(params.key)) error(404, 'Diesen Abschnitt gibt es nicht.');
	const section = await loadSection(params.key);
	if (!section) error(404, 'Der Abschnitt fehlt in der Datenbank – läuft die Webseite schon in der neuen Version?');
	const info = SECTIONS.find((s) => s.key === params.key)!;
	return { key: params.key, info, ...section, preview: previewUrl(info.anchor || '/') };
};

export const actions: Actions = {
	speichern: act(async ({ params }, f) => {
		if (!isKey(params.key)) bad('Unbekannter Abschnitt');
		let value: unknown;
		try {
			value = JSON.parse(f.str('value', 200_000) ?? '');
		} catch {
			return bad('Die Eingaben konnten nicht gelesen werden.');
		}
		const draft = await saveDraft(params.key as never, value);
		if (f.bool('publish')) {
			await publish(params.key as never);
			return { message: 'Veröffentlicht – in wenigen Sekunden auf astronox.dev' };
		}
		return { message: draft ? 'Als Entwurf gespeichert' : 'Keine Änderungen gegenüber der veröffentlichten Fassung' };
	}),
	veroeffentlichen: act(async ({ params }) => {
		if (!isKey(params.key)) bad('Unbekannter Abschnitt');
		const n = await publish(params.key as never);
		return { message: n ? 'Veröffentlicht – in wenigen Sekunden auf astronox.dev' : 'Kein Entwurf vorhanden' };
	}),
	verwerfen: act(async ({ params }) => {
		if (!isKey(params.key)) bad('Unbekannter Abschnitt');
		await discard(params.key as never);
		return { message: 'Entwurf verworfen' };
	})
};
