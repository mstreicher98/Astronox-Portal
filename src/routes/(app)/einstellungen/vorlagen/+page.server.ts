import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { checklistTemplates, mailTemplates } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	mails: await db.select().from(mailTemplates).orderBy(asc(mailTemplates.name)),
	lists: (await db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.name))).map((t) => ({ ...t, items: JSON.parse(t.items) as string[] }))
});

export const actions: Actions = {
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
		if (t?.key && ['angebot', 'rechnung', 'mahnung'].includes(t.key)) bad('Diese Vorlage wird für Angebote und Rechnungen gebraucht – bitte nur ändern.');
		await db.delete(mailTemplates).where(eq(mailTemplates.id, id));
		return { message: 'Vorlage gelöscht' };
	}),
	liste: act(async (_e, f) => {
		const id = f.id('id');
		const items = (f.str('items', 20_000) ?? '')
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		if (!items.length) bad('Bitte mindestens einen Punkt eintragen.');
		const values = { name: f.req('name', 'einen Namen', 100), items: JSON.stringify(items) };
		if (id) await db.update(checklistTemplates).set(values).where(eq(checklistTemplates.id, id));
		else await db.insert(checklistTemplates).values(values);
		return { message: 'Checkliste gespeichert' };
	}),
	liste_loeschen: act(async (_e, f) => {
		await db.delete(checklistTemplates).where(eq(checklistTemplates.id, f.id('id') ?? 0));
		return { message: 'Checkliste gelöscht' };
	})
};
