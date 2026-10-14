import { asc, eq } from 'drizzle-orm';
import { MAIL_DEFAULTS, WEB_MAILS, type WebMailKey } from '$lib/shared/mails';
import { db } from '$lib/server/db';
import { mailTemplates } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { getMailSettings } from '$lib/server/mail';
import { FIXED_TEMPLATES } from '$lib/server/seed';
import { setSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	templates: await db.select().from(mailTemplates).orderBy(asc(mailTemplates.name)),
	fixed: FIXED_TEMPLATES,
	mails: await getMailSettings()
});

export const actions: Actions = {
	fusszeile: act(async (_e, f) => {
		const cur = await getMailSettings();
		await setSetting('mails', { ...cur, footer: f.str('footer', 1000) ?? '' });
		return { message: 'Fußzeile gespeichert' };
	}),

	/** Eine automatische Mail der Webseite – gilt dort nach wenigen Sekunden */
	webseite: act(async (_e, f) => {
		const key = f.oneOf('key', WEB_MAILS.map((m) => m.key) as WebMailKey[], 'anfrage_kunde');
		const cur = await getMailSettings();
		const def = MAIL_DEFAULTS.web[key];
		cur.web[key] = {
			subject: f.req('subject', 'einen Betreff', 300),
			heading: f.str('heading', 200) ?? '',
			body: f.req('body', 'einen Text', 20_000),
			...(def.button !== undefined && { button: f.str('button', 80) ?? def.button })
		};
		if (key === 'termin_kunde') {
			cur.ablauf = {
				telefon: f.str('ablauf_telefon', 500) ?? '',
				video: f.str('ablauf_video', 500) ?? '',
				videoOhneLink: f.str('ablauf_ohne', 500) ?? ''
			};
		}
		await setSetting('mails', cur);
		return { message: 'Gespeichert – gilt ab der nächsten Mail der Webseite' };
	}),

	mail: act(async (_e, f) => {
		const id = f.id('id');
		const values = { name: f.req('name', 'einen Namen', 100), subject: f.req('subject', 'einen Betreff', 300), body: f.req('body', 'einen Text', 20_000), updatedAt: new Date().toISOString() };
		if (id) await db.update(mailTemplates).set(values).where(eq(mailTemplates.id, id));
		else await db.insert(mailTemplates).values(values);
		return { message: 'Vorlage gespeichert' };
	}),

	mail_loeschen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Vorlage fehlt');
		const [t] = await db.select().from(mailTemplates).where(eq(mailTemplates.id, id));
		if (t?.key && FIXED_TEMPLATES.includes(t.key)) bad('Diese Vorlage verschickt das Portal selbst – bitte nur ändern.');
		await db.delete(mailTemplates).where(eq(mailTemplates.id, id));
		return { message: 'Vorlage gelöscht' };
	})
};
