import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { addDays, today } from '$lib/shared/format';
import { ACTIVE_STAGES, OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { activities, customers, documents, domains, monitors, projects, tasks, timeEntries } from '$lib/server/db/schema';
import { bookings, pageViews } from '$lib/server/db/site';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const day = today();
	const year = day.slice(0, 4);
	const month = day.slice(0, 7);
	const count = sql<number>`count(*)`;

	// Umsatz der letzten 12 Monate (festgeschriebene Rechnungen, ohne Stornos)
	const from12 = `${addDays(`${month}-01`, -335).slice(0, 7)}-01`;

	const [stageCounts, [openValue], invoicedRows, [openItems], [hoursMonth], upcoming, dueTasks, recent, views, mons, expiring] = await Promise.all([
		db.select({ stage: projects.stage, n: count }).from(projects).where(isNull(projects.archivedAt)).groupBy(projects.stage),
		db
			.select({ v: sql<number>`coalesce(sum(${projects.valueCents}), 0)` })
			.from(projects)
			.where(and(inArray(projects.stage, ['anfrage', 'erstgespraech', 'angebot']), isNull(projects.archivedAt))),
		db
			.select({ m: sql<string>`substr(${documents.issueDate}, 1, 7)`, v: sql<number>`sum(${documents.netCents})` })
			.from(documents)
			.where(and(eq(documents.type, 'rechnung'), inArray(documents.status, ['offen', 'bezahlt', 'storniert']), gte(documents.issueDate, from12), isNotNull(documents.number)))
			.groupBy(sql`substr(${documents.issueDate}, 1, 7)`),
		db
			.select({ v: sql<number>`coalesce(sum(${documents.grossCents}), 0)`, n: count })
			.from(documents)
			.where(and(eq(documents.type, 'rechnung'), eq(documents.status, 'offen'))),
		db
			.select({ m: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)` })
			.from(timeEntries)
			.where(gte(timeEntries.startedAt, new Date(`${month}-01T00:00:00`).toISOString())),
		db
			.select()
			.from(bookings)
			.where(and(eq(bookings.status, 'bestaetigt'), gte(bookings.startsAt, new Date().toISOString())))
			.orderBy(asc(bookings.startsAt))
			.limit(5),
		db
			.select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, projectId: projects.id, project: projects.title })
			.from(tasks)
			.innerJoin(projects, eq(projects.id, tasks.projectId))
			.where(and(isNull(tasks.doneAt), isNotNull(tasks.dueDate), lte(tasks.dueDate, addDays(day, 7))))
			.orderBy(asc(tasks.dueDate))
			.limit(8),
		db
			.select({ a: activities, customer: customers.name, project: projects.title })
			.from(activities)
			.leftJoin(customers, eq(customers.id, activities.customerId))
			.leftJoin(projects, eq(projects.id, activities.projectId))
			.orderBy(desc(activities.createdAt))
			.limit(9),
		db
			.select({ day: pageViews.day, n: sql<number>`sum(${pageViews.views})` })
			.from(pageViews)
			.where(gte(pageViews.day, addDays(day, -29)))
			.groupBy(pageViews.day),
		db.select({ status: monitors.status, n: count }).from(monitors).where(eq(monitors.enabled, true)).groupBy(monitors.status),
		db
			.select({ name: domains.name, expiresOn: domains.expiresOn })
			.from(domains)
			.where(and(isNotNull(domains.expiresOn), lte(domains.expiresOn, addDays(day, 45))))
			.orderBy(asc(domains.expiresOn))
			.limit(4)
	]);

	const byStage = Object.fromEntries(stageCounts.map((s) => [s.stage, Number(s.n)]));
	const months = Array.from({ length: 12 }, (_, i) => {
		const d = new Date(`${month}-01T00:00:00Z`);
		d.setUTCMonth(d.getUTCMonth() - 11 + i);
		return d.toISOString().slice(0, 7);
	});
	const invoiced = new Map(invoicedRows.map((r) => [r.m, Number(r.v)]));
	const viewMap = new Map(views.map((v) => [v.day, Number(v.n)]));

	return {
		kpi: {
			leads: (byStage.anfrage ?? 0) + (byStage.erstgespraech ?? 0),
			newLeads: byStage.anfrage ?? 0,
			active: ACTIVE_STAGES.reduce((s, k) => s + (byStage[k] ?? 0), 0),
			open: OPEN_STAGES.reduce((s, k) => s + (byStage[k] ?? 0), 0),
			pipelineValue: Number(openValue.v),
			revenueYear: months.filter((m) => m.startsWith(year)).reduce((s, m) => s + (invoiced.get(m) ?? 0), 0),
			openItems: Number(openItems.v),
			openItemsCount: Number(openItems.n),
			minutesMonth: Number(hoursMonth.m)
		},
		stages: byStage,
		revenue: months.map((m) => ({ month: m, value: invoiced.get(m) ?? 0 })),
		visits: Array.from({ length: 30 }, (_, i) => {
			const d = addDays(day, i - 29);
			return { day: d, value: viewMap.get(d) ?? 0 };
		}),
		upcoming,
		dueTasks,
		recent: recent.map((r) => ({ ...r.a, customer: r.customer, project: r.project })),
		monitors: Object.fromEntries(mons.map((m) => [m.status, Number(m.n)])),
		expiring
	};
};
