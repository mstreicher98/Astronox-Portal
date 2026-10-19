import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { customers, mailMessages, projects } from '$lib/server/db/schema';
import { queueSeen } from '$lib/server/imap';
import { getSetting } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

/**
 * Ordner und Liste für den ganzen Posteingang (wie Outlook) – die geöffnete Mail
 * kommt aus /posteingang/[id]. Lädt mit der Glocke alle 30 s neu, so tauchen
 * neue Mails von selbst auf.
 */

const VIEWS = ['eingang', 'offen', 'gesendet', 'ignoriert'] as const;
type View = (typeof VIEWS)[number];

const inbox = and(eq(mailMessages.direction, 'ein'), eq(mailMessages.ignored, false));
const unassigned = and(inbox, isNull(mailMessages.customerId));

export const load: LayoutServerLoad = async ({ url, params, depends }) => {
	depends('app:shell');
	// Geöffnete Mail als gelesen markieren, bevor gezählt wird (auch im Postfach)
	if (params.id) {
		const read = await db
			.update(mailMessages)
			.set({ seen: true })
			.where(and(eq(mailMessages.id, Number(params.id)), eq(mailMessages.seen, false)))
			.returning({ imapMailbox: mailMessages.imapMailbox, imapUid: mailMessages.imapUid });
		queueSeen(read, true);
	}
	let view = url.searchParams.get('ansicht') as View | null;
	if (!view || !VIEWS.includes(view)) {
		// Direkt geöffnete Mail (Glocke, Kunde): passenden Ordner zeigen
		const [m] = params.id ? await db.select({ direction: mailMessages.direction, ignored: mailMessages.ignored }).from(mailMessages).where(eq(mailMessages.id, Number(params.id))) : [];
		view = m?.ignored ? 'ignoriert' : m?.direction === 'aus' ? 'gesendet' : 'eingang';
	}
	const where = view === 'gesendet' ? eq(mailMessages.direction, 'aus') : view === 'offen' ? unassigned : view === 'ignoriert' ? eq(mailMessages.ignored, true) : inbox;

	const count = sql<number>`count(*)`;
	const [mails, imap, stand, [unread], [open]] = await Promise.all([
		db
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
			.limit(200),
		getSetting('imap'),
		getSetting('imapStand'),
		db.select({ n: count }).from(mailMessages).where(and(inbox, eq(mailMessages.seen, false))),
		db.select({ n: count }).from(mailMessages).where(unassigned)
	]);

	return {
		view,
		mails,
		imap: { enabled: imap.enabled && !!imap.host, lastSync: stand.lastSync, lastError: stand.lastError },
		counts: { unread: Number(unread.n), unassigned: Number(open.n) }
	};
};
