import { env } from '$env/dynamic/private';
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { dateTime } from '$lib/shared/format';
import { logActivity } from '$lib/server/activity';
import { db } from '$lib/server/db';
import { mailTemplates, projects } from '$lib/server/db/schema';
import { bookings } from '$lib/server/db/site';
import { act, bad } from '$lib/server/forms';
import { fillTemplate, greeting, sendMail } from '$lib/server/mail';
import { getSetting, setSetting } from '$lib/server/settings';
import { cancelledHere } from '$lib/server/sync';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const now = new Date().toISOString();
	const [upcoming, past, termine] = await Promise.all([
		db
			.select({ b: bookings, projectId: projects.id, customerId: projects.customerId })
			.from(bookings)
			.leftJoin(projects, eq(projects.bookingId, bookings.id))
			.where(gte(bookings.startsAt, now))
			.orderBy(asc(bookings.startsAt)),
		db
			.select({ b: bookings, projectId: projects.id, customerId: projects.customerId })
			.from(bookings)
			.leftJoin(projects, eq(projects.bookingId, bookings.id))
			.where(lt(bookings.startsAt, now))
			.orderBy(desc(bookings.startsAt))
			.limit(30),
		getSetting('termine')
	]);
	const website = (env.WEBSITE_URL || 'https://astronox.dev').replace(/\/+$/, '');
	return {
		upcoming: upcoming.map((r) => ({ ...r.b, projectId: r.projectId, customerId: r.customerId })),
		past: past.map((r) => ({ ...r.b, projectId: r.projectId, customerId: r.customerId })),
		blocked: termine.blocked,
		feed: termine.calendarKey ? `${website}/kalender.ics?schluessel=${termine.calendarKey}` : null
	};
};

export const actions: Actions = {
	absagen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Termin fehlt');
		const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
		if (!b || b.status !== 'bestaetigt') bad('Dieser Termin ist schon abgesagt.');
		cancelledHere.add(b.id);
		await db.update(bookings).set({ status: 'abgesagt', cancelledAt: new Date().toISOString() }).where(eq(bookings.id, b.id));
		const reason = f.str('reason', 2000);
		const [p] = await db.select({ id: projects.id, customerId: projects.customerId }).from(projects).where(eq(projects.bookingId, b.id));
		if (f.bool('notify')) {
			// Vorlage „Termin absagen“ (Einstellungen → E-Mail-Texte)
			const [tpl] = await db.select().from(mailTemplates).where(eq(mailTemplates.key, 'terminabsage')).limit(1);
			const values = { anrede: greeting(b.name), name: b.name, datum: dateTime(b.startsAt), grund: reason ?? '' };
			await sendMail({
				to: b.email,
				subject: fillTemplate(tpl?.subject ?? 'Ihr Erstgespräch muss leider entfallen', values),
				text: fillTemplate(tpl?.body ?? '{{anrede}}\n\nleider muss ich unser Erstgespräch am {{datum}} Uhr absagen.\n\n{{grund}}\n\nViele Grüße\nMatthias Streicher', values).replace(/\n{3,}/g, '\n\n'),
				customerId: p?.customerId,
				projectId: p?.id
			});
		}
		await logActivity({ customerId: p?.customerId, projectId: p?.id, kind: 'termin', title: `Erstgespräch am ${dateTime(b.startsAt)} abgesagt (von mir)`, body: reason });
		return { message: 'Termin abgesagt' };
	}),

	abwesenheit: act(async (_e, f) => {
		const from = f.day('from') ?? bad('Bitte den ersten Tag angeben.');
		const to = f.day('to') ?? from;
		if (to < from) bad('Das Ende liegt vor dem Beginn.');
		const t = await getSetting('termine');
		t.blocked = [...t.blocked, { from, to, note: f.str('note', 100) ?? undefined }].sort((a, b) => a.from.localeCompare(b.from));
		await setSetting('termine', t);
		const [{ n }] = await db
			.select({ n: sql<number>`count(*)` })
			.from(bookings)
			.where(and(eq(bookings.status, 'bestaetigt'), gte(bookings.startsAt, `${from}T00:00:00`), lt(bookings.startsAt, `${to}T23:59:59`)));
		return { message: Number(n) ? `Gesperrt – Achtung: ${n} Termin(e) liegen bereits in diesem Zeitraum` : 'Zeitraum gesperrt – auf der Webseite nicht mehr buchbar' };
	}),

	abwesenheit_loeschen: act(async (_e, f) => {
		const i = f.int('index') ?? -1;
		const t = await getSetting('termine');
		t.blocked = t.blocked.filter((_, k) => k !== i);
		await setSetting('termine', t);
		return { message: 'Wieder buchbar' };
	})
};
