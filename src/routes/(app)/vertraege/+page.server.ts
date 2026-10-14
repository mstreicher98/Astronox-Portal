import { and, asc, eq, isNull } from 'drizzle-orm';
import { billContracts, billingsOf, cancelContract, revokeCancellation, saveContract, upcomingInvoices, withItems } from '$lib/server/contracts';
import { db } from '$lib/server/db';
import { contractBillings, contracts, customers, documents, projects } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { today } from '$lib/shared/format';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({ c: contracts, customer: customers.name, project: projects.title })
		.from(contracts)
		.innerJoin(customers, eq(customers.id, contracts.customerId))
		.leftJoin(projects, eq(projects.id, contracts.projectId))
		.orderBy(asc(customers.name), asc(contracts.title));
	const list = await withItems(rows.map((r) => r.c));
	const [billings, upcoming, allCustomers, allProjects, drafts] = await Promise.all([
		billingsOf(list.map((c) => c.id)),
		upcomingInvoices(8),
		db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name)),
		db.select({ id: projects.id, title: projects.title, customerId: projects.customerId }).from(projects).where(isNull(projects.archivedAt)).orderBy(asc(projects.title)),
		// Vertragsrechnungen, die noch als Entwurf auf Prüfung warten
		db
			.selectDistinct({ id: documents.id, title: documents.title, grossCents: documents.grossCents, issueDate: documents.issueDate, customer: customers.name })
			.from(documents)
			.innerJoin(contractBillings, eq(contractBillings.documentId, documents.id))
			.innerJoin(customers, eq(customers.id, documents.customerId))
			.where(and(eq(documents.type, 'rechnung'), eq(documents.status, 'entwurf')))
			.orderBy(asc(documents.issueDate))
	]);
	return {
		contracts: list.map((c, i) => ({ ...c, customer: rows[i].customer, project: rows[i].project })),
		billings,
		upcoming,
		customers: allCustomers,
		projects: allProjects,
		drafts,
		today: today()
	};
};

/** Kunde eines bestehenden Vertrags – Änderungen bleiben beim selben Kunden */
async function ownerOf(id: number | null, customerId: number | null) {
	if (id) {
		const [c] = await db.select({ customerId: contracts.customerId }).from(contracts).where(eq(contracts.id, id));
		if (!c) bad('Vertrag nicht gefunden');
		return { customerId: c.customerId, projectId: null };
	}
	if (!customerId) bad('Bitte einen Kunden wählen.');
	const [c] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId!));
	if (!c) bad('Kunde nicht gefunden');
	return { customerId: customerId!, projectId: null };
}

export const actions: Actions = {
	vertrag: act(async (_e, f) => {
		const o = await ownerOf(f.id('id'), f.id('customerId'));
		const projectId = f.id('projectId');
		if (projectId) {
			const [p] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.customerId, o.customerId)));
			if (!p) bad('Das Projekt gehört zu einem anderen Kunden.');
		}
		const r = await saveContract(o, f);
		return { message: r.message };
	}),

	vertrag_kuendigen: act(async (_e, f) => cancelContract(f.id('id') ?? bad('Vertrag fehlt'), f.day('cancelledOn') ?? today(), f.day('endDate'))),

	vertrag_kuendigung_zuruecknehmen: act(async (_e, f) => revokeCancellation(f.id('id') ?? bad('Vertrag fehlt'))),

	abrechnen: act(async () => {
		const r = await billContracts();
		if (!r.invoices) return { message: 'Heute ist nichts fällig.' };
		const parts = [r.sent && `${r.sent} gesendet`, r.drafts && `${r.drafts} als Entwurf`].filter(Boolean).join(', ');
		return { message: `${r.invoices} ${r.invoices === 1 ? 'Rechnung' : 'Rechnungen'} erstellt${parts ? ` (${parts})` : ''}` };
	})
};

