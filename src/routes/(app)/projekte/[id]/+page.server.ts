import fs from 'node:fs/promises';
import { error, redirect } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { date, today } from '$lib/shared/format';
import { STAGE_IDS, PROJECT_KINDS, type StageId } from '$lib/shared/stages';
import { logActivity } from '$lib/server/activity';
import { primaryRecipient } from '$lib/server/customers';
import { db } from '$lib/server/db';
import { checklistTemplates, customers, documents, files, milestones, projects, tasks, timeEntries } from '$lib/server/db/schema';
import { bookings, inquiries } from '$lib/server/db/site';
import { createDocument, markTimeBilled } from '$lib/server/documents';
import { act, bad } from '$lib/server/forms';
import { loadPanels, panelActions } from '$lib/server/panels';
import { moveProject } from '$lib/server/projects';
import { getSetting } from '$lib/server/settings';
import { filePath } from '$lib/server/uploads';
import type { Actions, PageServerLoad } from './$types';

async function project(id: string | number) {
	const [p] = await db.select().from(projects).where(eq(projects.id, Number(id)));
	if (!p) error(404, 'Dieses Projekt gibt es nicht.');
	return p;
}

export const load: PageServerLoad = async ({ params }) => {
	const p = await project(params.id);
	const [customer] = await db.select().from(customers).where(eq(customers.id, p.customerId));
	const [ms, ts, times, docs, templates, panels, recipient, rechnung, allCustomers] = await Promise.all([
		db.select().from(milestones).where(eq(milestones.projectId, p.id)).orderBy(asc(milestones.position), asc(milestones.id)),
		db.select().from(tasks).where(eq(tasks.projectId, p.id)).orderBy(asc(tasks.position), asc(tasks.id)),
		db
			.select({ e: timeEntries, invoice: documents.number })
			.from(timeEntries)
			.leftJoin(documents, eq(documents.id, timeEntries.invoiceId))
			.where(eq(timeEntries.projectId, p.id))
			.orderBy(desc(timeEntries.startedAt)),
		db.select().from(documents).where(eq(documents.projectId, p.id)).orderBy(desc(documents.issueDate), desc(documents.id)),
		db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.name)),
		loadPanels({ customerId: p.customerId, projectId: p.id }),
		primaryRecipient(p.customerId),
		getSetting('rechnung'),
		db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name))
	]);
	const [inquiry] = p.inquiryId ? await db.select().from(inquiries).where(eq(inquiries.id, p.inquiryId)) : [];
	const [booking] = p.bookingId ? await db.select().from(bookings).where(eq(bookings.id, p.bookingId)) : [];
	return {
		project: p,
		customer,
		recipient,
		inquiry: inquiry ?? null,
		booking: booking ?? null,
		milestones: ms,
		tasks: ts,
		times: times.map((t) => ({ ...t.e, invoice: t.invoice })),
		documents: docs,
		templates: templates.map((t) => ({ id: t.id, name: t.name, items: JSON.parse(t.items) as string[] })),
		defaultRate: p.hourlyRateCents ?? rechnung.hourlyRateCents,
		customers: allCustomers,
		...panels
	};
};

const owner = async (params: Record<string, string>) => {
	const p = await project(params.id);
	return { customerId: p.customerId, projectId: p.id };
};

export const actions: Actions = {
	...panelActions(owner),

	speichern: act(async ({ params }, f) => {
		const p = await project(params.id);
		await db
			.update(projects)
			.set({
				title: f.req('title', 'einen Titel', 200),
				kind: f.oneOf('kind', PROJECT_KINDS.map((k) => k.id), p.kind),
				customerId: f.id('customerId') ?? p.customerId,
				valueCents: f.money('value'),
				startDate: f.day('startDate'),
				dueDate: f.day('dueDate'),
				hourlyRateCents: f.money('hourlyRate'),
				repoUrl: f.url('repoUrl'),
				liveUrl: f.url('liveUrl'),
				stagingUrl: f.url('stagingUrl'),
				description: f.str('description', 20_000),
				updatedAt: new Date().toISOString()
			})
			.where(eq(projects.id, p.id));
		return { message: 'Gespeichert' };
	}),

	phase: act(async ({ params }, f) => {
		const p = await project(params.id);
		const stage = f.oneOf<StageId>('stage', STAGE_IDS, p.stage);
		await moveProject(p.id, stage, {}, f.str('reason', 1000));
		return { message: 'Phase geändert' };
	}),

	archivieren: act(async ({ params }) => {
		const p = await project(params.id);
		await db
			.update(projects)
			.set({ archivedAt: p.archivedAt ? null : new Date().toISOString() })
			.where(eq(projects.id, p.id));
		return { message: p.archivedAt ? 'Wieder aktiv' : 'Archiviert' };
	}),

	loeschen: act(async ({ params }) => {
		const p = await project(params.id);
		const [doc] = await db.select({ id: documents.id }).from(documents).where(eq(documents.projectId, p.id)).limit(1);
		if (doc) bad('Zu diesem Projekt gibt es Angebote oder Rechnungen – bitte archivieren statt löschen.');
		for (const f of await db.select().from(files).where(eq(files.projectId, p.id))) await fs.rm(filePath(f.storedName), { force: true });
		await db.delete(projects).where(eq(projects.id, p.id));
		await logActivity({ customerId: p.customerId, kind: 'system', title: `Projekt gelöscht: ${p.title}` });
		redirect(303, '/projekte');
	}),

	/* ---------------------------------------------------------- Aufgaben */

	aufgabe: act(async ({ params }, f) => {
		const p = await project(params.id);
		const id = f.id('id');
		const values = { title: f.req('title', 'eine Aufgabe', 300), dueDate: f.day('dueDate'), milestoneId: f.id('milestoneId'), notes: f.str('notes', 5000) };
		if (id) {
			await db.update(tasks).set(values).where(and(eq(tasks.id, id), eq(tasks.projectId, p.id)));
			return { message: 'Aufgabe gespeichert' };
		}
		const [last] = await db.select({ m: sql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks).where(eq(tasks.projectId, p.id));
		await db.insert(tasks).values({ ...values, projectId: p.id, position: Number(last.m) + 1 });
		return {};
	}),

	aufgabe_umschalten: act(async ({ params }, f) => {
		const p = await project(params.id);
		const id = f.id('id') ?? bad('Aufgabe fehlt');
		await db
			.update(tasks)
			.set({ doneAt: f.bool('done') ? new Date().toISOString() : null })
			.where(and(eq(tasks.id, id), eq(tasks.projectId, p.id)));
		return {};
	}),

	aufgabe_loeschen: act(async ({ params }, f) => {
		const p = await project(params.id);
		await db.delete(tasks).where(and(eq(tasks.id, f.id('id') ?? 0), eq(tasks.projectId, p.id)));
		return { message: 'Aufgabe gelöscht' };
	}),

	meilenstein: act(async ({ params }, f) => {
		const p = await project(params.id);
		const id = f.id('id');
		const values = { title: f.req('title', 'einen Meilenstein', 200), dueDate: f.day('dueDate') };
		if (id) await db.update(milestones).set(values).where(and(eq(milestones.id, id), eq(milestones.projectId, p.id)));
		else {
			const [last] = await db.select({ m: sql<number>`coalesce(max(${milestones.position}), 0)` }).from(milestones).where(eq(milestones.projectId, p.id));
			await db.insert(milestones).values({ ...values, projectId: p.id, position: Number(last.m) + 1 });
		}
		return { message: 'Meilenstein gespeichert' };
	}),

	meilenstein_umschalten: act(async ({ params }, f) => {
		const p = await project(params.id);
		const id = f.id('id') ?? bad('Meilenstein fehlt');
		const done = f.bool('done');
		await db
			.update(milestones)
			.set({ doneAt: done ? new Date().toISOString() : null })
			.where(and(eq(milestones.id, id), eq(milestones.projectId, p.id)));
		if (done) {
			const [m] = await db.select().from(milestones).where(eq(milestones.id, id));
			await logActivity({ customerId: p.customerId, projectId: p.id, kind: 'system', title: `Meilenstein erreicht: ${m.title}` });
		}
		return { message: done ? 'Meilenstein erreicht ✦' : 'Wieder offen' };
	}),

	meilenstein_loeschen: act(async ({ params }, f) => {
		const p = await project(params.id);
		await db.delete(milestones).where(and(eq(milestones.id, f.id('id') ?? 0), eq(milestones.projectId, p.id)));
		return { message: 'Meilenstein gelöscht' };
	}),

	checkliste: act(async ({ params }, f) => {
		const p = await project(params.id);
		const [t] = await db.select().from(checklistTemplates).where(eq(checklistTemplates.id, f.id('templateId') ?? 0));
		if (!t) bad('Vorlage nicht gefunden');
		const items: string[] = JSON.parse(t.items);
		const [ml] = await db.select({ m: sql<number>`coalesce(max(${milestones.position}), 0)` }).from(milestones).where(eq(milestones.projectId, p.id));
		const [m] = await db
			.insert(milestones)
			.values({ projectId: p.id, title: t.name, position: Number(ml.m) + 1, dueDate: f.day('dueDate') })
			.returning({ id: milestones.id });
		const [tl] = await db.select({ m: sql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks).where(eq(tasks.projectId, p.id));
		if (items.length) await db.insert(tasks).values(items.map((title, i) => ({ projectId: p.id, milestoneId: m.id, title, position: Number(tl.m) + 1 + i })));
		return { message: `${items.length} Aufgaben aus „${t.name}“ übernommen` };
	}),

	/* ---------------------------------------------------------- Zeit */

	zeit: act(async ({ params }, f) => {
		const p = await project(params.id);
		const day = f.day('day') ?? today();
		const raw = f.req('duration', 'die Dauer', 10).replace(',', '.');
		// „1:30“ oder „1.5“ Stunden oder „90m“
		const minutes = /^\d+:\d{1,2}$/.test(raw) ? Number(raw.split(':')[0]) * 60 + Number(raw.split(':')[1]) : /m$/i.test(raw) ? Number(raw.replace(/m$/i, '')) : Math.round(Number(raw) * 60);
		if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) bad('Bitte die Dauer als 1:30 oder 1,5 angeben.');
		const start = new Date(`${day}T09:00:00`);
		await db.insert(timeEntries).values({
			projectId: p.id,
			description: f.str('description', 300),
			startedAt: start.toISOString(),
			endedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
			minutes,
			billable: f.bool('billable'),
			rateCents: p.hourlyRateCents
		});
		return { message: 'Zeit erfasst' };
	}),

	zeit_loeschen: act(async ({ params }, f) => {
		const p = await project(params.id);
		const id = f.id('id') ?? bad('Eintrag fehlt');
		const [e] = await db.select().from(timeEntries).where(and(eq(timeEntries.id, id), eq(timeEntries.projectId, p.id)));
		if (e?.invoiceId) bad('Dieser Eintrag ist schon abgerechnet.');
		await db.delete(timeEntries).where(and(eq(timeEntries.id, id), eq(timeEntries.projectId, p.id)));
		return { message: 'Eintrag gelöscht' };
	}),

	abrechnen: act(async ({ params }) => {
		const p = await project(params.id);
		const r = await getSetting('rechnung');
		const open = await db
			.select()
			.from(timeEntries)
			.where(and(eq(timeEntries.projectId, p.id), eq(timeEntries.billable, true), isNull(timeEntries.invoiceId), sql`${timeEntries.endedAt} is not null`))
			.orderBy(asc(timeEntries.startedAt));
		if (!open.length) bad('Keine offenen, verrechenbaren Zeiten.');
		const id = await createDocument({
			type: 'rechnung',
			customerId: p.customerId,
			projectId: p.id,
			title: p.title,
			servicePeriod: `${date(open[0].startedAt)} – ${date(open.at(-1)!.startedAt)}`,
			items: open.map((e) => ({
				title: e.description || 'Entwicklung und Betreuung',
				description: date(e.startedAt),
				quantity: Math.round((e.minutes / 60) * 100) / 100,
				unit: 'Std.',
				unitPriceCents: e.rateCents ?? p.hourlyRateCents ?? r.hourlyRateCents
			}))
		});
		await markTimeBilled(
			id,
			open.map((e) => e.id)
		);
		redirect(303, `/rechnungen/${id}`);
	}),

	/* ---------------------------------------------------------- Belege */

	beleg: act(async ({ params }, f) => {
		const p = await project(params.id);
		const type = f.oneOf('type', ['angebot', 'rechnung'] as const, 'angebot');
		const items = p.valueCents ? [{ title: p.title, description: null, quantity: 1, unit: 'Pauschale', unitPriceCents: p.valueCents }] : [];
		const id = await createDocument({ type, customerId: p.customerId, projectId: p.id, title: p.title, items });
		redirect(303, `/rechnungen/${id}`);
	})
};

