import { redirect } from '@sveltejs/kit';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { customers, projects } from '$lib/server/db/schema';
import { createDocument } from '$lib/server/documents';
import { act, bad } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const [allCustomers, openProjects] = await Promise.all([
		db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name)),
		db
			.select({ id: projects.id, title: projects.title, customerId: projects.customerId, valueCents: projects.valueCents })
			.from(projects)
			.where(and(inArray(projects.stage, [...OPEN_STAGES, 'abgeschlossen']), isNull(projects.archivedAt)))
			.orderBy(asc(projects.title))
	]);
	return { type: url.searchParams.get('typ') === 'angebot' ? 'angebot' : 'rechnung', customers: allCustomers, projects: openProjects };
};

export const actions: Actions = {
	default: act(async (_e, f) => {
		const type = f.oneOf('type', ['angebot', 'rechnung'] as const, 'rechnung');
		const customerId = f.id('customerId') ?? bad('Bitte einen Kunden wählen.');
		const projectId = f.id('projectId');
		const [p] = projectId ? await db.select().from(projects).where(eq(projects.id, projectId)) : [];
		const id = await createDocument({
			type,
			customerId,
			projectId: p?.customerId === customerId ? p.id : null,
			title: f.str('title', 200) ?? p?.title ?? (type === 'angebot' ? 'Angebot' : 'Rechnung'),
			items: p?.valueCents ? [{ title: p.title, quantity: 1, unit: 'Pauschale', unitPriceCents: p.valueCents }] : []
		});
		redirect(303, `/rechnungen/${id}`);
	})
};
