import { and, asc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { customers, projects, tasks } from '$lib/server/db/schema';
import { createProjectAction } from '$lib/server/project-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Abgeschlossene und verlorene Projekte nur aus den letzten 60 Tagen
	const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
	const rows = await db
		.select({
			id: projects.id,
			title: projects.title,
			stage: projects.stage,
			position: projects.position,
			kind: projects.kind,
			valueCents: projects.valueCents,
			budgetLabel: projects.budgetLabel,
			dueDate: projects.dueDate,
			stageChangedAt: projects.stageChangedAt,
			createdAt: projects.createdAt,
			fromWebsite: sql<boolean>`${projects.inquiryId} is not null or ${projects.bookingId} is not null`,
			customerId: customers.id,
			customer: customers.name,
			tasksOpen: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.doneAt} is null)`,
			tasksDone: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.doneAt} is not null)`
		})
		.from(projects)
		.innerJoin(customers, eq(customers.id, projects.customerId))
		.where(and(isNull(projects.archivedAt), or(inArray(projects.stage, OPEN_STAGES), gte(projects.stageChangedAt, since))))
		.orderBy(asc(projects.position), asc(projects.id));

	const allCustomers = await db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name));
	return { projects: rows.map((r) => ({ ...r, fromWebsite: !!r.fromWebsite, tasksOpen: Number(r.tasksOpen), tasksDone: Number(r.tasksDone) })), customers: allCustomers };
};

export const actions: Actions = { neu: createProjectAction };
