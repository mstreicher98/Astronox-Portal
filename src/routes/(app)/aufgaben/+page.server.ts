import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { OPEN_STAGES } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { customers, projects, tasks } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
	const [rows, open] = await Promise.all([
		db
			.select({ id: tasks.id, title: tasks.title, notes: tasks.notes, dueDate: tasks.dueDate, doneAt: tasks.doneAt, projectId: projects.id, project: projects.title, customer: customers.name })
			.from(tasks)
			.innerJoin(projects, eq(projects.id, tasks.projectId))
			.innerJoin(customers, eq(customers.id, projects.customerId))
			.where(or(isNull(tasks.doneAt), and(isNotNull(tasks.doneAt), gte(tasks.doneAt, since))))
			.orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), desc(tasks.createdAt)),
		db
			.select({ id: projects.id, title: projects.title })
			.from(projects)
			.where(and(inArray(projects.stage, OPEN_STAGES), isNull(projects.archivedAt)))
			.orderBy(desc(projects.updatedAt))
	]);
	return { tasks: rows, projects: open };
};

export const actions: Actions = {
	neu: act(async (_e, f) => {
		const projectId = f.id('projectId') ?? bad('Bitte ein Projekt wählen.');
		const [last] = await db.select({ m: sql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks).where(eq(tasks.projectId, projectId));
		await db.insert(tasks).values({ projectId, title: f.req('title', 'eine Aufgabe', 300), dueDate: f.day('dueDate'), position: Number(last.m) + 1 });
		return { message: 'Aufgabe angelegt' };
	})
};
