import fs from 'node:fs/promises';
import { error, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';
import { primaryRecipient } from '$lib/server/customers';
import { db } from '$lib/server/db';
import { contacts, customers, documents, files, projects } from '$lib/server/db/schema';
import { bookings } from '$lib/server/db/site';
import { createDocument } from '$lib/server/documents';
import { act, bad } from '$lib/server/forms';
import { loadPanels, panelActions } from '$lib/server/panels';
import { createProjectAction } from '$lib/server/project-form';
import { filePath } from '$lib/server/uploads';
import type { Actions, PageServerLoad } from './$types';

async function customer(id: string | number) {
	const [c] = await db.select().from(customers).where(eq(customers.id, Number(id)));
	if (!c) error(404, 'Diesen Kunden gibt es nicht.');
	return c;
}

export const load: PageServerLoad = async ({ params }) => {
	const c = await customer(params.id);
	const [people, projs, docs, panels, recipient] = await Promise.all([
		db.select().from(contacts).where(eq(contacts.customerId, c.id)).orderBy(desc(contacts.isPrimary), asc(contacts.name)),
		db.select().from(projects).where(eq(projects.customerId, c.id)).orderBy(desc(projects.updatedAt)),
		db.select().from(documents).where(eq(documents.customerId, c.id)).orderBy(desc(documents.issueDate), desc(documents.id)),
		loadPanels({ customerId: c.id, projectId: null }),
		primaryRecipient(c.id)
	]);
	const emails = [c.email, ...people.map((p) => p.email)].filter((e): e is string => !!e).map((e) => e.toLowerCase());
	const calls = emails.length
		? await db
				.select()
				.from(bookings)
				.where(sql`lower(${bookings.email}) in (${sql.join(emails.map((e) => sql`${e}`), sql`, `)})`)
				.orderBy(desc(bookings.startsAt))
		: [];
	return { customer: c, contacts: people, projects: projs, documents: docs, bookings: calls, recipient, ...panels };
};

const owner = async (params: Record<string, string>) => ({ customerId: (await customer(params.id)).id, projectId: null });

export const actions: Actions = {
	...panelActions(owner),
	neu: createProjectAction,

	speichern: act(async ({ params }, f) => {
		const c = await customer(params.id);
		await db
			.update(customers)
			.set({
				kind: f.oneOf('kind', ['firma', 'privat'] as const, c.kind),
				name: f.req('name', 'den Namen', 200),
				email: f.email('email'),
				phone: f.str('phone', 60),
				website: f.url('website'),
				street: f.str('street', 200),
				zip: f.str('zip', 20),
				city: f.str('city', 100),
				country: f.str('country', 80) ?? 'Österreich',
				vatId: f.str('vatId', 40),
				notes: f.has('notes') ? f.str('notes', 20_000) : c.notes,
				updatedAt: new Date().toISOString()
			})
			.where(eq(customers.id, c.id));
		return { message: 'Gespeichert' };
	}),

	notizen: act(async ({ params }, f) => {
		const c = await customer(params.id);
		await db.update(customers).set({ notes: f.str('notes', 20_000), updatedAt: new Date().toISOString() }).where(eq(customers.id, c.id));
		return { message: 'Gespeichert' };
	}),

	kontakt: act(async ({ params }, f) => {
		const c = await customer(params.id);
		const id = f.id('id');
		const values = { name: f.req('name', 'den Namen', 200), role: f.str('role', 100), email: f.email('email'), phone: f.str('phone', 60), isPrimary: f.bool('isPrimary') };
		if (values.isPrimary) await db.update(contacts).set({ isPrimary: false }).where(eq(contacts.customerId, c.id));
		if (id) await db.update(contacts).set(values).where(and(eq(contacts.id, id), eq(contacts.customerId, c.id)));
		else await db.insert(contacts).values({ ...values, customerId: c.id });
		return { message: 'Ansprechperson gespeichert' };
	}),

	kontakt_loeschen: act(async ({ params }, f) => {
		const c = await customer(params.id);
		await db.delete(contacts).where(and(eq(contacts.id, f.id('id') ?? 0), eq(contacts.customerId, c.id)));
		return { message: 'Ansprechperson entfernt' };
	}),

	archivieren: act(async ({ params }) => {
		const c = await customer(params.id);
		await db
			.update(customers)
			.set({ archivedAt: c.archivedAt ? null : new Date().toISOString() })
			.where(eq(customers.id, c.id));
		return { message: c.archivedAt ? 'Wieder aktiv' : 'Archiviert' };
	}),

	loeschen: act(async ({ params }) => {
		const c = await customer(params.id);
		const [p] = await db.select({ id: projects.id }).from(projects).where(eq(projects.customerId, c.id)).limit(1);
		const [d] = await db.select({ id: documents.id }).from(documents).where(eq(documents.customerId, c.id)).limit(1);
		if (p || d) bad('Der Kunde hat Projekte oder Belege – bitte archivieren statt löschen.');
		for (const f of await db.select().from(files).where(eq(files.customerId, c.id))) await fs.rm(filePath(f.storedName), { force: true });
		await db.delete(customers).where(eq(customers.id, c.id));
		await logActivity({ kind: 'system', title: `Kunde gelöscht: ${c.name}` });
		redirect(303, '/kunden');
	}),

	beleg: act(async ({ params }, f) => {
		const c = await customer(params.id);
		const type = f.oneOf('type', ['angebot', 'rechnung'] as const, 'angebot');
		const id = await createDocument({ type, customerId: c.id, title: type === 'angebot' ? 'Angebot' : 'Rechnung' });
		redirect(303, `/rechnungen/${id}`);
	})
};
