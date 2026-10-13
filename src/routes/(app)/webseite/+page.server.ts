import { SECTIONS } from '$lib/shared/site';
import { act } from '$lib/server/forms';
import { discard, previewUrl, publish, sectionStates, websiteUrl } from '$lib/server/website';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const states = await sectionStates();
	return {
		sections: SECTIONS.map((s) => ({ ...s, ...(states[s.key] ?? { hasDraft: false, publishedAt: null, updatedAt: null }) })),
		preview: previewUrl('/'),
		website: websiteUrl()
	};
};

export const actions: Actions = {
	veroeffentlichen: act(async () => {
		const n = await publish();
		return { message: n ? `${n} Abschnitt${n === 1 ? '' : 'e'} veröffentlicht – in wenigen Sekunden auf astronox.dev` : 'Keine Entwürfe vorhanden' };
	}),
	verwerfen: act(async () => {
		await discard();
		return { message: 'Alle Entwürfe verworfen' };
	})
};
