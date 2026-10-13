import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { ACTIVE_STAGES, OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { customers, projects, tasks, timeEntries } from '$lib/server/db/schema';
import { createProjectAction } from '$lib/server/project-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const filter = url.searchParams.get('filter') ?? 'offen';
	const where =
		filter === 'aktiv'
			? and(inArray(projects.stage, ACTIVE_STAGES), isNull(projects.archivedAt))
			: filter === 'abgeschlossen'
				? and(inArray(projects.stage, ['abgeschlossen', 'verloren']), isNull(projects.archivedAt))
				: filter === 'archiv'
					? isNotNull(projects.archivedAt)
					: filter === 'alle'
						? undefined
						: and(inArray(projects.stage, OPEN_STAGES), isNull(projects.archivedAt));
	const rows = await db
		.select({
			id: projects.id,
			title: projects.title,
			stage: projects.stage,
			kind: projects.kind,
			valueCents: projects.valueCents,
			dueDate: projects.dueDate,
			updatedAt: projects.updatedAt,
			liveUrl: projects.liveUrl,
			customerId: customers.id,
			customer: customers.name,
			tasksOpen: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.doneAt} is null)`,
			tasksDone: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.doneAt} is not null)`,
			minutes: sql<number>`(select coalesce(sum(${timeEntries.minutes}), 0) from ${timeEntries} where ${timeEntries.projectId} = ${projects.id})`
		})
		.from(projects)
		.innerJoin(customers, eq(customers.id, projects.customerId))
		.where(where)
		.orderBy(desc(projects.updatedAt));
	const allCustomers = await db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name));
	return {
		filter,
		projects: rows.map((r) => ({ ...r, tasksOpen: Number(r.tasksOpen), tasksDone: Number(r.tasksDone), minutes: Number(r.minutes) })),
		customers: allCustomers
	};
};

export const actions: Actions = { neu: createProjectAction };
