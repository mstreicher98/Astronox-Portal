import { and, asc, desc, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import type { Choice } from '$lib/shared/settings';
import { dateTime } from '$lib/shared/format';
import { logActivity, notify } from './activity';
import { ensureCustomer } from './customers';
import { db } from './db';
import { projects } from './db/schema';
import { bookings, inquiries } from './db/site';
import { getSetting, setSetting } from './settings';

/**
 * Holt neue Projektanfragen und Terminbuchungen von der Webseite ab.
 * Jede Anfrage wird zu Kunde + Projekt in der Phase „Anfrage“, jede Buchung
 * landet beim passenden Projekt (oder einem neuen) in der Phase „Erstgespräch“.
 */

const label = (list: Choice[], id: string) => list.find((x) => x.id === id)?.label ?? id;

/** Projektart der Anfrage → Art des Projekts im Portal */
const KIND: Record<string, string> = { webseite: 'webseite', redesign: 'redesign', webapp: 'webapp', tool: 'tool', hosting: 'hosting' };

/** Neue Karten kommen oben in die Spalte */
export async function topPosition(stage: string): Promise<number> {
	const [first] = await db
		.select({ p: projects.position })
		.from(projects)
		.where(eq(projects.stage, stage as 'anfrage'))
		.orderBy(asc(projects.position))
		.limit(1);
	return (first?.p ?? 1) - 1;
}

let running = false;

/** Im Portal abgesagte Termine – dafür keine zusätzliche Benachrichtigung */
export const cancelledHere = new Set<number>();

export async function syncWebsite(): Promise<void> {
	if (running) return;
	running = true;
	try {
		const cursor = await getSetting('sync');
		const before = JSON.stringify(cursor);
		const options = await getSetting('anfrage');

		/* ---------- Projektanfragen */
		const newInquiries = await db.select().from(inquiries).where(gt(inquiries.id, cursor.inquiryId)).orderBy(asc(inquiries.id)).limit(50);
		for (const q of newInquiries) {
			const customer = await ensureCustomer({ name: q.name, company: q.company, email: q.email, phone: q.phone, source: 'webseite' });
			const type = label(options.projectTypes, q.projectType);
			const [p] = await db
				.insert(projects)
				.values({
					customerId: customer.id,
					title: `${type} – ${q.company || q.name}`,
					kind: KIND[q.projectType] ?? 'sonstiges',
					stage: 'anfrage',
					position: await topPosition('anfrage'),
					budgetLabel: label(options.budgets, q.budget),
					timeframeLabel: label(options.timeframes, q.timeframe),
					description: q.message,
					inquiryId: q.id,
					createdAt: q.createdAt
				})
				.returning({ id: projects.id });
			await logActivity({
				customerId: customer.id,
				projectId: p.id,
				kind: 'anfrage',
				title: 'Projektanfrage über die Webseite',
				body: q.message,
				meta: { inquiryId: q.id }
			});
			await notify({ kind: 'anfrage', title: `Neue Anfrage: ${q.company || q.name}`, body: `${type} · ${label(options.budgets, q.budget)}`, url: `/projekte/${p.id}` });
			cursor.inquiryId = q.id;
		}

		/* ---------- Terminbuchungen */
		const newBookings = await db.select().from(bookings).where(gt(bookings.id, cursor.bookingId)).orderBy(asc(bookings.id)).limit(50);
		for (const b of newBookings) {
			const customer = await ensureCustomer({ name: b.name, company: b.company, email: b.email, phone: b.phone, source: 'termin' });
			// offenes Projekt in einer frühen Phase weiterverwenden
			const [open] = await db
				.select()
				.from(projects)
				.where(and(eq(projects.customerId, customer.id), inArray(projects.stage, ['anfrage', 'erstgespraech'])))
				.orderBy(desc(projects.createdAt))
				.limit(1);
			let projectId: number;
			if (open) {
				projectId = open.id;
				const move = open.stage === 'anfrage' ? { stage: 'erstgespraech' as const, stageChangedAt: new Date().toISOString(), position: await topPosition('erstgespraech') } : {};
				await db
					.update(projects)
					.set({ bookingId: open.bookingId ?? b.id, ...move, updatedAt: new Date().toISOString() })
					.where(eq(projects.id, open.id));
			} else {
				const [p] = await db
					.insert(projects)
					.values({
						customerId: customer.id,
						title: `Erstgespräch – ${b.company || b.name}`,
						kind: 'sonstiges',
						stage: 'erstgespraech',
						position: await topPosition('erstgespraech'),
						description: b.message,
						bookingId: b.id,
						createdAt: b.createdAt
					})
					.returning({ id: projects.id });
				projectId = p.id;
			}
			await logActivity({
				customerId: customer.id,
				projectId,
				kind: 'termin',
				title: `Erstgespräch gebucht für ${dateTime(b.startsAt)} (${b.kind === 'video' ? 'Video-Call' : 'Telefon'})`,
				body: b.message,
				meta: { bookingId: b.id }
			});
			if (b.status === 'bestaetigt') {
				await notify({ kind: 'termin', title: `Neuer Termin: ${b.company || b.name}`, body: dateTime(b.startsAt), url: '/termine' });
			}
			cursor.bookingId = b.id;
		}

		/* ---------- Absagen über den Link in der Bestätigung */
		const firstRun = !cursor.cancelledAt;
		const cancelled = await db
			.select()
			.from(bookings)
			.where(and(isNotNull(bookings.cancelledAt), gt(bookings.cancelledAt, cursor.cancelledAt || '0')))
			.orderBy(asc(bookings.cancelledAt))
			.limit(50);
		for (const b of cancelled) {
			// Beim allerersten Abgleich alte Absagen nur übernehmen, nicht melden
			if (!firstRun && !cancelledHere.delete(b.id)) {
				const [p] = await db.select({ id: projects.id, customerId: projects.customerId }).from(projects).where(eq(projects.bookingId, b.id)).limit(1);
				await logActivity({ customerId: p?.customerId ?? null, projectId: p?.id ?? null, kind: 'termin', title: `Erstgespräch am ${dateTime(b.startsAt)} abgesagt`, meta: { bookingId: b.id } });
				await notify({ kind: 'termin', title: `Termin abgesagt: ${b.company || b.name}`, body: dateTime(b.startsAt), url: '/termine' });
			}
			cursor.cancelledAt = b.cancelledAt!;
		}
		if (!cursor.cancelledAt) cursor.cancelledAt = new Date().toISOString();

		if (JSON.stringify(cursor) !== before) await setSetting('sync', cursor);
	} catch (err) {
		console.error('[abgleich]', err);
	} finally {
		running = false;
	}
}
