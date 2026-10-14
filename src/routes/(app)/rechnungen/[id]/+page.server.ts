import { error, redirect } from '@sveltejs/kit';
import { asc, eq, isNull } from 'drizzle-orm';
import { money, today } from '$lib/shared/format';
import type { SiteContent } from '$lib/shared/site';
import { logActivity } from '$lib/server/activity';
import { primaryRecipient } from '$lib/server/customers';
import { db } from '$lib/server/db';
import { customers, documentItems, documents, mailMessages, projects } from '$lib/server/db/schema';
import { siteContent } from '$lib/server/db/site';
import { cancelInvoice, createDocument, deleteBlocker, deleteDocument, finalize, invoiceFromQuote, loadDocument, recalc, reopenDocument, typeLabel } from '$lib/server/documents';
import { act, bad } from '$lib/server/forms';
import { advanceTo } from '$lib/server/projects';
import type { Actions, PageServerLoad } from './$types';

async function doc(id: string) {
	const loaded = await loadDocument(Number(id));
	if (!loaded) error(404, 'Diesen Beleg gibt es nicht.');
	return loaded;
}

/** Pakete von der Webseite als Vorlage für Positionen („ab € 790“ → 790) */
async function packages() {
	const [row] = await db.select().from(siteContent).where(eq(siteContent.key, 'pakete'));
	if (!row) return [];
	try {
		const p = JSON.parse(row.published) as SiteContent['pakete'];
		const price = (s: string) => {
			const m = /([\d.]+(?:,\d+)?)/.exec(s.replace(/\s/g, ''));
			return m ? Math.round(Number(m[1].replace(/\./g, '').replace(',', '.')) * 100) : 0;
		};
		return [
			...p.items.map((i) => ({ title: `Paket ${i.name}`, description: i.features.join(', '), unit: 'Pauschale', unitPriceCents: price(i.price) })),
			{ title: p.hosting.title, description: p.hosting.text, unit: 'Monat', unitPriceCents: price(p.hosting.price) }
		];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const { doc: d, items } = await doc(params.id);
	const [customer] = await db.select().from(customers).where(eq(customers.id, d.customerId));
	const [allCustomers, customerProjects, recipient, related, mails, pkgs] = await Promise.all([
		db.select({ id: customers.id, name: customers.name }).from(customers).where(isNull(customers.archivedAt)).orderBy(asc(customers.name)),
		db.select({ id: projects.id, title: projects.title }).from(projects).where(eq(projects.customerId, d.customerId)).orderBy(asc(projects.title)),
		primaryRecipient(d.customerId),
		db
			.select({ id: documents.id, type: documents.type, number: documents.number, status: documents.status, quoteId: documents.quoteId, cancelsId: documents.cancelsId })
			.from(documents)
			.where(eq(documents.customerId, d.customerId)),
		db.select({ id: mailMessages.id, subject: mailMessages.subject, date: mailMessages.date, toAddrs: mailMessages.toAddrs, status: mailMessages.status }).from(mailMessages).where(eq(mailMessages.documentId, d.id)),
		packages()
	]);
	const links = {
		quote: d.quoteId ? related.find((r) => r.id === d.quoteId) : null,
		invoices: related.filter((r) => r.quoteId === d.id),
		cancels: d.cancelsId ? related.find((r) => r.id === d.cancelsId) : null,
		cancelledBy: related.find((r) => r.cancelsId === d.id) ?? null
	};
	return { doc: d, items, customer, customers: allCustomers, projects: customerProjects, recipient, links, mails, packages: pkgs, deleteBlocker: deleteBlocker(d) };
};

interface ItemInput {
	title: string;
	description?: string;
	quantity: number;
	unit: string;
	unitPriceCents: number;
}

export const actions: Actions = {
	speichern: act(async ({ params }, f) => {
		const { doc: d } = await doc(params.id);
		if (d.status !== 'entwurf') bad('Bitte den Beleg zuerst über „Bearbeiten“ wieder öffnen.');
		let items: ItemInput[];
		try {
			items = JSON.parse(f.str('items', 200_000) ?? '[]');
		} catch {
			return bad('Positionen konnten nicht gelesen werden.');
		}
		items = items.filter((i) => i.title?.trim());
		const customerId = f.id('customerId') ?? d.customerId;
		const projectId = f.id('projectId');
		await db
			.update(documents)
			.set({
				customerId,
				projectId: customerId === d.customerId ? projectId : null,
				title: f.req('title', 'einen Titel', 200),
				issueDate: f.day('issueDate') ?? d.issueDate,
				dueDate: f.day('dueDate'),
				servicePeriod: f.str('servicePeriod', 200),
				intro: f.str('intro', 5000),
				outro: f.str('outro', 5000),
				taxMode: f.oneOf('taxMode', ['klein', 'ust'] as const, d.taxMode),
				taxRate: Math.min(30, Math.max(0, f.int('taxRate') ?? d.taxRate)),
				updatedAt: new Date().toISOString()
			})
			.where(eq(documents.id, d.id));
		await db.delete(documentItems).where(eq(documentItems.documentId, d.id));
		if (items.length) {
			await db.insert(documentItems).values(
				items.map((it, i) => ({
					documentId: d.id,
					position: i,
					title: it.title.trim().slice(0, 300),
					description: it.description?.trim().slice(0, 3000) || null,
					quantity: Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1,
					unit: (it.unit || 'Stk.').slice(0, 30),
					unitPriceCents: Math.round(Number(it.unitPriceCents) || 0),
					totalCents: 0
				}))
			);
		}
		await recalc(d.id);
		return { message: 'Gespeichert' };
	}),

	festschreiben: act(async ({ params }) => {
		const { doc: d } = await doc(params.id);
		const [c] = await db.select().from(customers).where(eq(customers.id, d.customerId));
		if (d.type === 'rechnung' && !c.street) bad('Für eine Rechnung braucht der Kunde eine Anschrift (Kunde bearbeiten).');
		try {
			const number = await finalize(d.id);
			return { message: `${typeLabel(d.type)} ${number} festgeschrieben` };
		} catch (err) {
			return bad((err as Error).message);
		}
	}),

	bezahlt: act(async ({ params }, f) => {
		const { doc: d } = await doc(params.id);
		if (d.type !== 'rechnung' || d.status !== 'offen') bad('Nur offene Rechnungen können als bezahlt markiert werden.');
		const paidAt = f.day('paidAt') ?? today();
		await db.update(documents).set({ status: 'bezahlt', paidAt, updatedAt: new Date().toISOString() }).where(eq(documents.id, d.id));
		await logActivity({ customerId: d.customerId, projectId: d.projectId, kind: 'zahlung', title: `Zahlung erhalten: ${d.number} (${money(d.grossCents)})`, meta: { documentId: d.id } });
		return { message: 'Als bezahlt markiert ✦' };
	}),

	offen: act(async ({ params }) => {
		const { doc: d } = await doc(params.id);
		if (!['bezahlt', 'angenommen', 'abgelehnt'].includes(d.status)) bad('Status lässt sich nicht zurücksetzen.');
		await db.update(documents).set({ status: 'offen', paidAt: null, decidedAt: null }).where(eq(documents.id, d.id));
		return { message: 'Wieder offen' };
	}),

	entscheidung: act(async ({ params }, f) => {
		const { doc: d } = await doc(params.id);
		if (d.type !== 'angebot' || d.status === 'entwurf') bad('Nur verschickte Angebote können angenommen oder abgelehnt werden.');
		const accepted = f.bool('angenommen');
		await db
			.update(documents)
			.set({ status: accepted ? 'angenommen' : 'abgelehnt', decidedAt: new Date().toISOString() })
			.where(eq(documents.id, d.id));
		await logActivity({ customerId: d.customerId, projectId: d.projectId, kind: 'angebot', title: `Angebot ${d.number} ${accepted ? 'angenommen' : 'abgelehnt'}`, meta: { documentId: d.id } });
		if (accepted) await advanceTo(d.projectId, 'auftrag');
		return { message: accepted ? 'Angenommen – das Projekt ist jetzt ein Auftrag' : 'Als abgelehnt markiert' };
	}),

	in_rechnung: act(async ({ params }) => {
		const { doc: d } = await doc(params.id);
		const id = await invoiceFromQuote(d.id);
		redirect(303, `/rechnungen/${id}`);
	}),

	stornieren: act(async ({ params }) => {
		const { doc: d } = await doc(params.id);
		try {
			const id = await cancelInvoice(d.id);
			redirect(303, `/rechnungen/${id}`);
		} catch (err) {
			if ((err as { status?: number }).status === 303) throw err;
			return bad((err as Error).message);
		}
	}),

	kopieren: act(async ({ params }) => {
		const { doc: d, items } = await doc(params.id);
		const id = await createDocument({
			type: d.type,
			customerId: d.customerId,
			projectId: d.projectId,
			title: d.title,
			items: items.map((i) => ({ title: i.title, description: i.description, quantity: i.quantity, unit: i.unit, unitPriceCents: i.unitPriceCents }))
		});
		redirect(303, `/rechnungen/${id}`);
	}),

	bearbeiten: act(async ({ params }) => {
		const { doc: d } = await doc(params.id);
		try {
			await reopenDocument(d.id);
		} catch (err) {
			return bad((err as Error).message);
		}
		return { message: `${typeLabel(d.type)} ${d.number} ist wieder ein Entwurf` };
	}),

	loeschen: act(async ({ params }) => {
		const { doc: d } = await doc(params.id);
		try {
			await deleteDocument(d.id);
		} catch (err) {
			return bad((err as Error).message);
		}
		redirect(303, `/rechnungen?typ=${d.type}`);
	})
};
