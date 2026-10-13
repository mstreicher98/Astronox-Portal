import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { contracts, customers, domains, monitors, projects } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { checkMonitor, recentChecks, uptimes } from '$lib/server/monitor';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [mons, cons, doms, up, allCustomers] = await Promise.all([
		db.select({ m: monitors, customer: customers.name, project: projects.title }).from(monitors).leftJoin(customers, eq(customers.id, monitors.customerId)).leftJoin(projects, eq(projects.id, monitors.projectId)).orderBy(asc(monitors.name)),
		db.select({ c: contracts, customer: customers.name }).from(contracts).innerJoin(customers, eq(customers.id, contracts.customerId)).orderBy(asc(customers.name)),
		db.select({ d: domains, customer: customers.name }).from(domains).leftJoin(customers, eq(customers.id, domains.customerId)).orderBy(asc(domains.expiresOn)),
		uptimes(30),
		db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name))
	]);
	const strips = await Promise.all(mons.map((r) => recentChecks(r.m.id, 48)));
	return {
		monitors: mons.map((r, i) => ({ ...r.m, customer: r.customer, project: r.project, uptime: up.get(r.m.id) ?? null, checks: strips[i] })),
		contracts: cons.map((r) => ({ ...r.c, customer: r.customer })),
		domains: doms.map((r) => ({ ...r.d, customer: r.customer })),
		customers: allCustomers
	};
};

export const actions: Actions = {
	pruefen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Überwachung fehlt');
		const [m] = await db.select().from(monitors).where(eq(monitors.id, id));
		if (!m) bad('Überwachung nicht gefunden');
		const r = await checkMonitor(m);
		return { message: r.ok ? `Online · ${r.ms} ms` : `Nicht erreichbar: ${r.error}` };
	})
};
