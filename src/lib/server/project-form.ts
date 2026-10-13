import { redirect, type RequestEvent } from '@sveltejs/kit';
import { STAGE_IDS, type StageId } from '$lib/shared/stages';
import { logActivity } from './activity';
import { db } from './db';
import { contacts, customers, projects } from './db/schema';
import { act, bad } from './forms';
import { topPosition } from './sync';

/**
 * „Neues Projekt“ – gemeinsam für Pipeline, Projektliste und Kundenseite.
 * Entweder ein vorhandener Kunde (customerId) oder gleich ein neuer (newCustomer*).
 */
export const createProjectAction = act(async (_event: RequestEvent, f) => {
	const title = f.req('title', 'einen Projekttitel', 200);
	const stage = f.oneOf<StageId>('stage', STAGE_IDS, 'anfrage');
	let customerId = f.id('customerId');
	if (!customerId) {
		const name = f.str('newCustomer', 200) ?? bad('Bitte einen Kunden wählen oder neu anlegen.');
		const person = f.str('newContact', 200);
		const email = f.email('newEmail');
		const kind = f.oneOf('newKind', ['firma', 'privat'] as const, 'firma');
		const [c] = await db.insert(customers).values({ kind, name, email, source: 'manuell' }).returning({ id: customers.id });
		if (person && kind === 'firma') await db.insert(contacts).values({ customerId: c.id, name: person, email, isPrimary: true });
		customerId = c.id;
	}
	const [p] = await db
		.insert(projects)
		.values({
			customerId,
			title,
			kind: f.str('kind', 40) ?? 'webseite',
			stage,
			position: await topPosition(stage),
			valueCents: f.money('value'),
			dueDate: f.day('dueDate'),
			description: f.str('description', 10_000)
		})
		.returning({ id: projects.id });
	await logActivity({ customerId, projectId: p.id, kind: 'system', title: 'Projekt angelegt' });
	if (f.bool('open')) redirect(303, `/projekte/${p.id}`);
	return { message: 'Projekt angelegt', id: p.id };
});
