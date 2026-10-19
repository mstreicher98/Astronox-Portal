import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customers, mailMessages, projects } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { deleteMails, queueSeen, syncInbox } from '$lib/server/imap';
import { getSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const view = url.searchParams.get('ansicht') ?? 'eingang';
	const where =
		view === 'gesendet'
			? eq(mailMessages.direction, 'aus')
			: view === 'offen'
				? and(eq(mailMessages.direction, 'ein'), isNull(mailMessages.customerId), eq(mailMessages.ignored, false))
				: view === 'ignoriert'
					? eq(mailMessages.ignored, true)
					: and(eq(mailMessages.direction, 'ein'), eq(mailMessages.ignored, false));
	const rows = await db
		.select({
			id: mailMessages.id,
			direction: mailMessages.direction,
			subject: mailMessages.subject,
			fromAddr: mailMessages.fromAddr,
			fromName: mailMessages.fromName,
			toAddrs: mailMessages.toAddrs,
			date: mailMessages.date,
			seen: mailMessages.seen,
			/** stammt aus dem Postfach – Löschen landet dort im Papierkorb */
			inMailbox: sql<boolean>`${mailMessages.imapUid} is not null`,
			status: mailMessages.status,
			attachments: mailMessages.attachments,
			snippet: sql<string>`substr(replace(replace(coalesce(${mailMessages.text}, ''), char(10), ' '), char(13), ' '), 1, 160)`,
			customerId: customers.id,
			customer: customers.name,
			projectId: projects.id,
			project: projects.title
		})
		.from(mailMessages)
		.leftJoin(customers, eq(customers.id, mailMessages.customerId))
		.leftJoin(projects, eq(projects.id, mailMessages.projectId))
		.where(where)
		.orderBy(desc(mailMessages.date))
		.limit(200);
	const [imap, stand, [unassigned]] = await Promise.all([
		getSetting('imap'),
		getSetting('imapStand'),
		db
			.select({ n: sql<number>`count(*)` })
			.from(mailMessages)
			.where(and(eq(mailMessages.direction, 'ein'), isNull(mailMessages.customerId), eq(mailMessages.ignored, false)))
	]);
	return { view, mails: rows, imap: { enabled: imap.enabled && !!imap.host, lastSync: stand.lastSync, lastError: stand.lastError }, unassigned: Number(unassigned.n) };
};

export const actions: Actions = {
	abrufen: act(async () => {
		const r = await syncInbox();
		if (r.error) return { message: `Abruf fehlgeschlagen: ${r.error}` };
		return { message: r.fetched ? `${r.fetched} neue Mail${r.fetched === 1 ? '' : 's'}` : 'Keine neuen Mails' };
	}),
	alle_gelesen: act(async () => {
		const rows = await db
			.update(mailMessages)
			.set({ seen: true })
			.where(eq(mailMessages.seen, false))
			.returning({ imapMailbox: mailMessages.imapMailbox, imapUid: mailMessages.imapUid });
		queueSeen(rows, true);
		return { message: 'Alles als gelesen markiert' };
	}),

	gelesen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Mail fehlt.');
		const seen = f.bool('seen');
		const rows = await db.update(mailMessages).set({ seen }).where(eq(mailMessages.id, id)).returning({ imapMailbox: mailMessages.imapMailbox, imapUid: mailMessages.imapUid });
		queueSeen(rows, seen);
	}),

	loeschen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Mail fehlt.');
		const r = await deleteMails([id]);
		return { message: r.mailboxError ? `Im Portal gelöscht, im Postfach aber nicht: ${r.mailboxError}` : 'Gelöscht' };
	})
};
