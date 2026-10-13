import { json } from '@sveltejs/kit';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { customers, projects } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Offene Projekte für Auswahllisten (Timer, Rechnungen …) */
export const GET: RequestHandler = async () => {
	const rows = await db
		.select({ id: projects.id, title: projects.title, customer: customers.name, customerId: customers.id })
		.from(projects)
		.innerJoin(customers, eq(customers.id, projects.customerId))
		.where(and(inArray(projects.stage, OPEN_STAGES), isNull(projects.archivedAt)))
		.orderBy(desc(projects.updatedAt));
	return json(rows);
};
