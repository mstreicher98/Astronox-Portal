import { error } from '@sveltejs/kit';
import { asc, eq, inArray, isNull } from 'drizzle-orm';
import { logActivity } from '$lib/server/activity';
import { db } from '$lib/server/db';
import { contacts, customers, files, mailMessages, projects } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

async function mail(id: string) {
	const [m] = await db.select().from(mailMessages).where(eq(mailMessages.id, Number(id)));
	if (!m) error(404, 'Diese Mail gibt es nicht.');
	return m;
}

export const load: PageServerLoad = async ({ params }) => {
	const m = await mail(params.id);
	if (!m.seen) await db.update(mailMessages).set({ seen: true }).where(eq(mailMessages.id, m.id));
	const att: { fileId?: number; name: string; size: number }[] = JSON.parse(m.attachments || '[]');
	const fileIds = att.map((a) => a.fileId).filter((x): x is number => !!x);
	const [customer] = m.customerId ? await db.select().from(customers).where(eq(customers.id, m.customerId)) : [];
	const [allCustomers, customerProjects, attachedFiles, thread] = await Promise.all([
		db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name)),
		m.customerId ? db.select({ id: projects.id, title: projects.title }).from(projects).where(eq(projects.customerId, m.customerId)).orderBy(asc(projects.title)) : [],
		fileIds.length ? db.select({ id: files.id, name: files.name, size: files.size, mime: files.mime }).from(files).where(inArray(files.id, fileIds)) : [],
		m.messageId || m.inReplyTo
			? db
					.select({ id: mailMessages.id, subject: mailMessages.subject, date: mailMessages.date, direction: mailMessages.direction })
					.from(mailMessages)
					.where(inArray(mailMessages.messageId, [m.inReplyTo, ...(m.references?.split(/\s+/) ?? [])].filter((x): x is string => !!x)))
			: []
	]);
	return { mail: { ...m, seen: true }, customer: customer ?? null, customers: allCustomers, projects: customerProjects, files: attachedFiles, thread };
};

export const actions: Actions = {
	zuordnen: act(async ({ params }, f) => {
		const m = await mail(params.id);
		const customerId = f.id('customerId');
		const projectId = f.id('projectId');
		await db.update(mailMessages).set({ customerId, projectId: customerId ? projectId : null, ignored: false }).where(eq(mailMessages.id, m.id));
		// Anhänge mitnehmen
		const ids = (JSON.parse(m.attachments || '[]') as { fileId?: number }[]).map((a) => a.fileId).filter((x): x is number => !!x);
		if (ids.length) await db.update(files).set({ customerId, projectId: customerId ? projectId : null }).where(inArray(files.id, ids));
		if (customerId && !m.customerId) {
			await logActivity({ customerId, projectId, kind: m.direction === 'ein' ? 'mail_ein' : 'mail_aus', title: `E-Mail ${m.direction === 'ein' ? 'erhalten' : 'gesendet'}: ${m.subject}`, meta: { mailId: m.id } });
		}
		return { message: customerId ? 'Zugeordnet' : 'Zuordnung entfernt' };
	}),

	als_kunde: act(async ({ params }) => {
		const m = await mail(params.id);
		if (m.customerId) bad('Die Mail ist schon zugeordnet.');
		const name = m.fromName?.trim() || m.fromAddr;
		const [c] = await db.insert(customers).values({ kind: 'privat', name, email: m.fromAddr, source: 'mail' }).returning({ id: customers.id });
		await db.update(mailMessages).set({ customerId: c.id }).where(eq(mailMessages.fromAddr, m.fromAddr));
		await logActivity({ customerId: c.id, kind: 'mail_ein', title: `E-Mail erhalten: ${m.subject}`, meta: { mailId: m.id } });
		return { message: `${name} als Kunde angelegt` };
	}),

	als_kontakt: act(async ({ params }, f) => {
		const m = await mail(params.id);
		const customerId = f.id('customerId') ?? bad('Bitte einen Kunden wählen.');
		await db.insert(contacts).values({ customerId, name: m.fromName?.trim() || m.fromAddr, email: m.fromAddr });
		await db.update(mailMessages).set({ customerId }).where(eq(mailMessages.fromAddr, m.fromAddr));
		return { message: 'Als Ansprechperson gespeichert – künftige Mails werden automatisch zugeordnet' };
	}),

	ausblenden: act(async ({ params }) => {
		const m = await mail(params.id);
		await db.update(mailMessages).set({ ignored: !m.ignored }).where(eq(mailMessages.id, m.id));
		return { message: m.ignored ? 'Wieder im Eingang' : 'Ausgeblendet' };
	}),

	ungelesen: act(async ({ params }) => {
		const m = await mail(params.id);
		await db.update(mailMessages).set({ seen: false }).where(eq(mailMessages.id, m.id));
		return { message: 'Als ungelesen markiert' };
	})
};
