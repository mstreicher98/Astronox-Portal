import { randomBytes } from 'node:crypto';
import { act, bad } from '$lib/server/forms';
import { getSetting, setSetting } from '$lib/server/settings';
import { websiteUrl } from '$lib/server/website';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const t = await getSetting('termine');
	return { termine: t, feed: t.calendarKey ? `${websiteUrl()}/kalender.ics?schluessel=${t.calendarKey}` : null };
};

const TIME = /^([01]?\d|2[0-4]):[0-5]\d$/;

export const actions: Actions = {
	speichern: act(async (_e, f) => {
		const t = await getSetting('termine');
		let hours: { weekday: number; from: string; to: string }[];
		try {
			hours = JSON.parse(f.str('hours', 20_000) ?? '[]');
		} catch {
			return bad('Die Zeiten konnten nicht gelesen werden.');
		}
		const pad = (s: string) => s.padStart(5, '0');
		for (const h of hours) {
			if (!(h.weekday >= 0 && h.weekday <= 6) || !TIME.test(h.from) || !TIME.test(h.to) || pad(h.from) >= pad(h.to)) bad(`Ungültiger Zeitraum: ${h.from} – ${h.to}`);
		}
		await setSetting('termine', {
			...t,
			hours: hours.map((h) => ({ weekday: h.weekday, from: pad(h.from), to: pad(h.to) })),
			duration: Math.min(240, Math.max(10, f.int('duration') ?? 30)),
			buffer: Math.min(120, Math.max(0, f.int('buffer') ?? 0)),
			leadHours: Math.min(24 * 14, Math.max(0, f.int('leadHours') ?? 24)),
			days: Math.min(180, Math.max(1, f.int('days') ?? 28)),
			holidays: f.bool('holidays'),
			videoLink: f.url('videoLink') ?? ''
		});
		return { message: 'Gespeichert – die Webseite zeigt die neuen Zeiten in wenigen Sekunden' };
	}),
	abo: act(async (_e, f) => {
		const t = await getSetting('termine');
		t.calendarKey = f.bool('aus') ? '' : randomBytes(24).toString('hex');
		await setSetting('termine', t);
		return { message: t.calendarKey ? 'Neue Abo-Adresse erzeugt – die alte funktioniert nicht mehr' : 'Kalender-Abo abgeschaltet' };
	})
};
