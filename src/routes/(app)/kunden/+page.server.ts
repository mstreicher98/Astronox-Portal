import { redirect } from '@sveltejs/kit';
import { asc, isNotNull, isNull, sql } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';
import { db } from '$lib/server/db';
import { activities, contacts, customers, documents, projects } from '$lib/server/db/schema';
import { act } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

/**
 * Spalte des Kunden für die Unterabfragen – ausdrücklich mit Tabellennamen: Drizzle schreibt
 * Spalten ohne Tabelle, solange die äußere Abfrage nur eine Tabelle hat. Dann wäre "id" in
 * der Unterabfrage deren eigene id (alle Kunden bekamen dieselbe Ansprechperson).
 */
const customerId = sql`${customers}.${sql.identifier('id')}`;

export const load: PageServerLoad = async ({ url }) => {
	const archiv = url.searchParams.get('filter') === 'archiv';
	const rows = await db
		.select({
			id: customers.id,
			kind: customers.kind,
			name: customers.name,
			email: customers.email,
			phone: customers.phone,
			city: customers.city,
			source: customers.source,
			createdAt: customers.createdAt,
			openProjects: sql<number>`(select count(*) from ${projects} where ${projects.customerId} = ${customerId} and ${projects.stage} not in ('abgeschlossen', 'verloren') and ${projects.archivedAt} is null)`,
			won: sql<number>`(select count(*) from ${projects} where ${projects.customerId} = ${customerId} and ${projects.stage} in ('auftrag', 'in_arbeit', 'abnahme', 'abgeschlossen'))`,
			revenue: sql<number>`(select coalesce(sum(${documents.netCents}), 0) from ${documents} where ${documents.customerId} = ${customerId} and ${documents.type} = 'rechnung' and ${documents.status} in ('offen', 'bezahlt'))`,
			lastActivity: sql<string | null>`(select max(${activities.createdAt}) from ${activities} where ${activities.customerId} = ${customerId})`,
			contact: sql<string | null>`(select ${contacts.name} from ${contacts} where ${contacts.customerId} = ${customerId} order by ${contacts.isPrimary} desc limit 1)`
		})
		.from(customers)
		.where(archiv ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt))
		.orderBy(asc(customers.name));
	return {
		archiv,
		customers: rows.map((r) => ({ ...r, openProjects: Number(r.openProjects), won: Number(r.won), revenue: Number(r.revenue) }))
	};
};

export const actions: Actions = {
	neu: act(async (_e, f) => {
		const kind = f.oneOf('kind', ['firma', 'privat'] as const, 'firma');
		const name = f.req('name', kind === 'firma' ? 'den Firmennamen' : 'den Namen', 200);
		const email = f.email('email');
		const [c] = await db
			.insert(customers)
			.values({
				kind,
				name,
				email,
				phone: f.str('phone', 60),
				website: f.url('website'),
				street: f.str('street', 200),
				zip: f.str('zip', 20),
				city: f.str('city', 100),
				vatId: f.str('vatId', 40),
				source: f.str('source', 40) ?? 'manuell'
			})
			.returning({ id: customers.id });
		const person = f.str('contact', 200);
		if (person && kind === 'firma') await db.insert(contacts).values({ customerId: c.id, name: person, email, phone: f.str('phone', 60), isPrimary: true });
		await logActivity({ customerId: c.id, kind: 'system', title: 'Kunde angelegt' });
		redirect(303, `/kunden/${c.id}`);
	})
};
