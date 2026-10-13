import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { today } from '$lib/shared/format';
import { db } from '$lib/server/db';
import { documents, mailMessages, monitors, notifications, projects, timeEntries } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:shell');
	const count = sql<number>`count(*)`;
	const [[anfragen], [mails], [ueberfaellig], [offline], [ungelesen], recent, [timer]] = await Promise.all([
		db.select({ n: count }).from(projects).where(and(eq(projects.stage, 'anfrage'), isNull(projects.archivedAt))),
		db
			.select({ n: count })
			.from(mailMessages)
			.where(and(eq(mailMessages.direction, 'ein'), eq(mailMessages.seen, false), eq(mailMessages.ignored, false))),
		db
			.select({ n: count })
			.from(documents)
			.where(and(eq(documents.type, 'rechnung'), eq(documents.status, 'offen'), lt(documents.dueDate, today()))),
		db.select({ n: count }).from(monitors).where(and(eq(monitors.enabled, true), eq(monitors.status, 'offline'))),
		db.select({ n: count }).from(notifications).where(isNull(notifications.readAt)),
		db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(12),
		db
			.select({ id: timeEntries.id, startedAt: timeEntries.startedAt, description: timeEntries.description, projectId: projects.id, project: projects.title })
			.from(timeEntries)
			.innerJoin(projects, eq(projects.id, timeEntries.projectId))
			.where(isNull(timeEntries.endedAt))
			.limit(1)
	]);
	return {
		user: { name: locals.user!.name, email: locals.user!.email },
		badges: { anfragen: Number(anfragen.n), mails: Number(mails.n), ueberfaellig: Number(ueberfaellig.n), offline: Number(offline.n) },
		notifications: { unread: Number(ungelesen.n), recent },
		timer: timer ?? null
	};
};
