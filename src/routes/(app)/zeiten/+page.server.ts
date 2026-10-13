import { and, asc, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';
import { addMonths, today } from '$lib/shared/format';
import { OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { customers, documents, projects, timeEntries } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { getSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('monat') ?? '') ? url.searchParams.get('monat')! : today().slice(0, 7);
	const from = new Date(`${month}-01T00:00:00`).toISOString();
	const to = new Date(`${addMonths(`${month}-01`, 1)}T00:00:00`).toISOString();
	const [entries, open, rechnung] = await Promise.all([
		db
			.select({ e: timeEntries, project: projects.title, projectId: projects.id, projectRate: projects.hourlyRateCents, customer: customers.name, invoice: documents.number })
			.from(timeEntries)
			.innerJoin(projects, eq(projects.id, timeEntries.projectId))
			.innerJoin(customers, eq(customers.id, projects.customerId))
			.leftJoin(documents, eq(documents.id, timeEntries.invoiceId))
			.where(and(gte(timeEntries.startedAt, from), lt(timeEntries.startedAt, to)))
			.orderBy(desc(timeEntries.startedAt)),
		db
			.select({ id: projects.id, title: projects.title })
			.from(projects)
			.where(and(inArray(projects.stage, OPEN_STAGES), isNull(projects.archivedAt)))
			.orderBy(asc(projects.title)),
		getSetting('rechnung')
	]);
	return {
		month,
		entries: entries.map((r) => ({ ...r.e, project: r.project, customer: r.customer, invoice: r.invoice, rate: r.e.rateCents ?? r.projectRate ?? rechnung.hourlyRateCents })),
		projects: open
	};
};

export const actions: Actions = {
	neu: act(async (_e, f) => {
		const projectId = f.id('projectId') ?? bad('Bitte ein Projekt wählen.');
		const day = f.day('day') ?? today();
		const raw = f.req('duration', 'die Dauer', 10).replace(',', '.');
		const minutes = /^\d+:\d{1,2}$/.test(raw) ? Number(raw.split(':')[0]) * 60 + Number(raw.split(':')[1]) : Math.round(Number(raw) * 60);
		if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) bad('Bitte die Dauer als 1:30 oder 1,5 angeben.');
		const [p] = await db.select({ rate: projects.hourlyRateCents }).from(projects).where(eq(projects.id, projectId));
		const start = new Date(`${day}T09:00:00`);
		await db.insert(timeEntries).values({
			projectId,
			description: f.str('description', 300),
			startedAt: start.toISOString(),
			endedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
			minutes,
			billable: f.bool('billable'),
			rateCents: p?.rate ?? null
		});
		return { message: 'Zeit erfasst' };
	}),
	loeschen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Eintrag fehlt');
		const [e] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
		if (e?.invoiceId) bad('Dieser Eintrag ist schon abgerechnet.');
		await db.delete(timeEntries).where(eq(timeEntries.id, id));
		return { message: 'Gelöscht' };
	})
};
