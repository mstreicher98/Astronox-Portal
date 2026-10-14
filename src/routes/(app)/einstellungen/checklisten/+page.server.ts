import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { checklistTemplates } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	lists: (await db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.name))).map((t) => ({ ...t, items: JSON.parse(t.items) as string[] }))
});

export const actions: Actions = {
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
