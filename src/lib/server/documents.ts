import fs from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { addDays, addMonths, date, money, today } from '$lib/shared/format';
import { intervalOf } from '$lib/shared/stages';
import { logActivity, notify } from './activity';
import { db, DOCS_DIR } from './db';
import { contracts, customers, documentItems, documents, sequences, timeEntries, type DocumentItem, type DocumentRow } from './db/schema';
import { renderPdf } from './pdf';
import { getSetting } from './settings';

/**
 * Angebote und Rechnungen.
 *
 * Ein Beleg ist zuerst ein Entwurf und frei änderbar. Beim Festschreiben bekommt
 * er die nächste fortlaufende Nummer, Empfänger und Absender werden eingefroren
 * und das PDF wird abgelegt. Festgeschriebene Rechnungen ändern sich nie mehr –
 * korrigiert wird mit einer Stornorechnung.
 */

export type DocType = 'angebot' | 'rechnung';

export const typeLabel = (t: string) => (t === 'angebot' ? 'Angebot' : 'Rechnung');

/** Netto, Steuer und Gesamt aus den Positionen neu berechnen */
export async function recalc(id: number) {
	const [doc] = await db.select().from(documents).where(eq(documents.id, id));
	if (!doc) return;
	const items = await db.select().from(documentItems).where(eq(documentItems.documentId, id));
	let net = 0;
	for (const it of items) {
		const total = Math.round(it.quantity * it.unitPriceCents);
		if (total !== it.totalCents) await db.update(documentItems).set({ totalCents: total }).where(eq(documentItems.id, it.id));
		net += total;
	}
	const tax = doc.taxMode === 'ust' ? Math.round((net * doc.taxRate) / 100) : 0;
	await db.update(documents).set({ netCents: net, taxCents: tax, grossCents: net + tax, updatedAt: new Date().toISOString() }).where(eq(documents.id, id));
}

/** Nächste Nummer im Nummernkreis des Jahres – lückenlos, auch bei gleichzeitigen Zugriffen */
async function nextNumber(type: DocType, issueDate: string): Promise<string> {
	const r = await getSetting('rechnung');
	const year = issueDate.slice(0, 4);
	const key = `${type}-${year}`;
	const [row] = await db
		.insert(sequences)
		.values({ key, last: 1 })
		.onConflictDoUpdate({ target: sequences.key, set: { last: sql`${sequences.last} + 1` } })
		.returning({ last: sequences.last });
	const prefix = (type === 'angebot' ? r.quotePrefix : r.invoicePrefix).replace('{JJJJ}', year);
	return `${prefix}${String(row.last).padStart(Math.max(1, r.digits), '0')}`;
}

export interface NewDocument {
	type: DocType;
	customerId: number;
	projectId?: number | null;
	contractId?: number | null;
	quoteId?: number | null;
	title: string;
	servicePeriod?: string | null;
	issueDate?: string;
	items?: { title: string; description?: string | null; quantity: number; unit: string; unitPriceCents: number }[];
}

export async function createDocument(input: NewDocument): Promise<number> {
	const r = await getSetting('rechnung');
	const issueDate = input.issueDate ?? today();
	const [doc] = await db
		.insert(documents)
		.values({
			type: input.type,
			customerId: input.customerId,
			projectId: input.projectId ?? null,
			contractId: input.contractId ?? null,
			quoteId: input.quoteId ?? null,
			title: input.title,
			servicePeriod: input.servicePeriod ?? null,
			issueDate,
			dueDate: addDays(issueDate, input.type === 'angebot' ? r.quoteValidDays : r.paymentDays),
			intro: input.type === 'angebot' ? r.quoteIntro : r.invoiceIntro,
			outro: input.type === 'angebot' ? r.quoteOutro : r.invoiceOutro,
			taxMode: r.taxMode,
			taxRate: r.taxRate
		})
		.returning({ id: documents.id });
	if (input.items?.length) {
		await db.insert(documentItems).values(
			input.items.map((it, i) => ({
				documentId: doc.id,
				position: i,
				title: it.title,
				description: it.description ?? null,
				quantity: it.quantity,
				unit: it.unit,
				unitPriceCents: it.unitPriceCents,
				totalCents: Math.round(it.quantity * it.unitPriceCents)
			}))
		);
	}
	await recalc(doc.id);
	return doc.id;
}

export async function loadDocument(id: number): Promise<{ doc: DocumentRow; items: DocumentItem[] } | null> {
	const [doc] = await db.select().from(documents).where(eq(documents.id, id));
	if (!doc) return null;
	const items = await db.select().from(documentItems).where(eq(documentItems.documentId, id)).orderBy(asc(documentItems.position), asc(documentItems.id));
	return { doc, items };
}

export interface Party {
	name: string;
	lines: string[];
	vatId?: string;
	email?: string;
}

async function recipientOf(customerId: number): Promise<Party> {
	const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
	const lines = [c.street, [c.zip, c.city].filter(Boolean).join(' '), c.country && c.country !== 'Österreich' ? c.country : ''].filter((x): x is string => !!x);
	return { name: c.name, lines, vatId: c.vatId ?? undefined, email: c.email ?? undefined };
}

export async function senderNow() {
	const f = await getSetting('firma');
	return f;
}

/** Festschreiben: Nummer vergeben, Daten einfrieren, PDF ablegen */
export async function finalize(id: number): Promise<string> {
	const loaded = await loadDocument(id);
	if (!loaded) throw new Error('Beleg nicht gefunden');
	const { doc, items } = loaded;
	if (doc.status !== 'entwurf') return doc.number!;
	if (!items.length) throw new Error('Der Beleg hat noch keine Positionen.');
	await recalc(id);
	const number = await nextNumber(doc.type, doc.issueDate);
	const recipient = await recipientOf(doc.customerId);
	const sender = await senderNow();
	const finalizedAt = new Date().toISOString();
	await db
		.update(documents)
		.set({ number, status: 'offen', recipient: JSON.stringify(recipient), sender: JSON.stringify(sender), finalizedAt, updatedAt: finalizedAt })
		.where(eq(documents.id, id));
	const pdf = await documentPdf(id);
	const file = `${number.replace(/[^\w-]/g, '_')}.pdf`;
	await fs.writeFile(path.join(DOCS_DIR, file), pdf);
	await db.update(documents).set({ pdfFile: file }).where(eq(documents.id, id));
	await logActivity({
		customerId: doc.customerId,
		projectId: doc.projectId,
		kind: doc.type,
		title: `${typeLabel(doc.type)} ${number} festgeschrieben (${money(doc.grossCents)})`,
		meta: { documentId: id }
	});
	return number;
}

/** PDF: festgeschriebene Belege aus der Ablage, Entwürfe frisch mit Wasserzeichen */
export async function documentPdf(id: number): Promise<Buffer> {
	const loaded = await loadDocument(id);
	if (!loaded) throw new Error('Beleg nicht gefunden');
	const { doc, items } = loaded;
	if (doc.pdfFile) {
		try {
			return await fs.readFile(path.join(DOCS_DIR, doc.pdfFile));
		} catch {
			// Datei fehlt – neu erzeugen aus den eingefrorenen Daten
		}
	}
	const recipient: Party = doc.recipient ? JSON.parse(doc.recipient) : await recipientOf(doc.customerId);
	const sender = doc.sender ? JSON.parse(doc.sender) : await senderNow();
	const r = await getSetting('rechnung');
	let cancels: string | null = null;
	if (doc.cancelsId) {
		const [orig] = await db.select({ number: documents.number, issueDate: documents.issueDate }).from(documents).where(eq(documents.id, doc.cancelsId));
		if (orig) cancels = `${orig.number} vom ${date(orig.issueDate)}`;
	}
	return renderPdf({ doc, items, recipient, sender, kleinText: r.kleinText, cancels });
}

export function pdfName(doc: Pick<DocumentRow, 'type' | 'number' | 'id'>) {
	return `${typeLabel(doc.type)}-${(doc.number ?? `Entwurf-${doc.id}`).replace(/[^\w-]/g, '_')}.pdf`;
}

/** Rechnung aus einem Angebot – Positionen werden übernommen */
export async function invoiceFromQuote(quoteId: number): Promise<number> {
	const loaded = await loadDocument(quoteId);
	if (!loaded || loaded.doc.type !== 'angebot') throw new Error('Angebot nicht gefunden');
	const { doc, items } = loaded;
	return createDocument({
		type: 'rechnung',
		customerId: doc.customerId,
		projectId: doc.projectId,
		quoteId: doc.id,
		title: doc.title,
		items: items.map((it) => ({ title: it.title, description: it.description, quantity: it.quantity, unit: it.unit, unitPriceCents: it.unitPriceCents }))
	});
}

/** Storno: neue Rechnung mit negativen Beträgen, sofort festgeschrieben */
export async function cancelInvoice(invoiceId: number): Promise<number> {
	const loaded = await loadDocument(invoiceId);
	if (!loaded || loaded.doc.type !== 'rechnung' || loaded.doc.status === 'entwurf' || loaded.doc.status === 'storniert') throw new Error('Diese Rechnung kann nicht storniert werden.');
	const { doc, items } = loaded;
	const id = await createDocument({
		type: 'rechnung',
		customerId: doc.customerId,
		projectId: doc.projectId,
		title: `Storno zu ${doc.number}`,
		servicePeriod: doc.servicePeriod,
		items: items.map((it) => ({ title: it.title, description: it.description, quantity: -it.quantity, unit: it.unit, unitPriceCents: it.unitPriceCents }))
	});
	await db
		.update(documents)
		.set({
			cancelsId: doc.id,
			taxMode: doc.taxMode,
			taxRate: doc.taxRate,
			intro: `hiermit storniere ich die Rechnung ${doc.number} vom ${date(doc.issueDate)} in voller Höhe.`,
			outro: doc.status === 'bezahlt' ? 'Den bereits bezahlten Betrag überweise ich Ihnen zurück.' : 'Die ursprüngliche Rechnung ist damit gegenstandslos.',
			dueDate: null
		})
		.where(eq(documents.id, id));
	await recalc(id);
	await finalize(id);
	await db.update(documents).set({ status: 'storniert', updatedAt: new Date().toISOString() }).where(eq(documents.id, doc.id));
	// Storno gilt als erledigt
	await db.update(documents).set({ status: 'bezahlt', paidAt: today() }).where(eq(documents.id, id));
	// abgerechnete Zeiten wieder freigeben
	await db.update(timeEntries).set({ invoiceId: null }).where(eq(timeEntries.invoiceId, doc.id));
	return id;
}

/* ------------------------------------------------------------------ Abo-Rechnungen */

/** Rechnungsentwürfe für Hosting- und Wartungsverträge, deren Zeitraum begonnen hat */
export async function recurringInvoices(): Promise<number> {
	const day = today();
	const due = await db
		.select()
		.from(contracts)
		.where(and(eq(contracts.active, true), eq(contracts.autoInvoice, true), lte(contracts.nextInvoiceDate, day)));
	let created = 0;
	for (const c of due) {
		// bis zu 12 versäumte Zeiträume nachholen
		let next = c.nextInvoiceDate;
		for (let i = 0; i < 12 && next <= day && (!c.endDate || next <= c.endDate); i++) {
			const iv = intervalOf(c.interval);
			const end = addDays(addMonths(next, iv.months), -1);
			const period = `${date(next)} – ${date(end)}`;
			const id = await createDocument({
				type: 'rechnung',
				customerId: c.customerId,
				projectId: c.projectId,
				contractId: c.id,
				title: c.title,
				servicePeriod: period,
				items: [{ title: c.title, description: [c.description, `Zeitraum ${period}`].filter(Boolean).join('\n'), quantity: 1, unit: 'Pauschale', unitPriceCents: c.amountCents }]
			});
			created++;
			await notify({ kind: 'rechnung', title: `Rechnungsentwurf: ${c.title}`, body: `${period} · ${money(c.amountCents)}`, url: `/rechnungen/${id}` });
			next = addMonths(next, iv.months);
		}
		await db.update(contracts).set({ nextInvoiceDate: next, updatedAt: new Date().toISOString() }).where(eq(contracts.id, c.id));
	}
	return created;
}

/** Überfällige Rechnungen einmal pro Woche melden */
export async function overdueReminders() {
	const day = today();
	const open = await db
		.select({ id: documents.id, number: documents.number, dueDate: documents.dueDate, remindedAt: documents.remindedAt, grossCents: documents.grossCents, customer: customers.name })
		.from(documents)
		.innerJoin(customers, eq(customers.id, documents.customerId))
		.where(and(eq(documents.type, 'rechnung'), eq(documents.status, 'offen'), lte(documents.dueDate, addDays(day, -1))));
	for (const d of open) {
		if (d.remindedAt && Date.now() - Date.parse(d.remindedAt) < 7 * 86_400_000) continue;
		await notify({ kind: 'rechnung', title: `Überfällig: ${d.number}`, body: `${d.customer} · ${money(d.grossCents)} · fällig seit ${date(d.dueDate)}`, url: `/rechnungen/${d.id}` });
		await db.update(documents).set({ remindedAt: new Date().toISOString() }).where(eq(documents.id, d.id));
	}
}

/** Zeiten, die mit einer Rechnung abgerechnet wurden, als abgerechnet markieren */
export async function markTimeBilled(invoiceId: number, entryIds: number[]) {
	if (!entryIds.length) return;
	await db.update(timeEntries).set({ invoiceId }).where(inArray(timeEntries.id, entryIds));
}
