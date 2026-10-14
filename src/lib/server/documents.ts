import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, inArray, lte, max, sql } from 'drizzle-orm';
import { addDays, date, money, time, today } from '$lib/shared/format';
import { documentNumber } from '$lib/shared/numbers';
import { logActivity, notify } from './activity';
import { db, DOCS_DIR } from './db';
import { customers, documentItems, documents, sequences, timeEntries, type DocumentItem, type DocumentRow } from './db/schema';
import { quoteResponses } from './db/site';
import { renderPdf } from './pdf';
import { getSetting } from './settings';
import { websiteUrl } from './website';

/**
 * Angebote und Rechnungen.
 *
 * Ein Beleg ist zuerst ein Entwurf und frei änderbar. Beim Festschreiben bekommt
 * er die nächste fortlaufende Nummer, Empfänger und Absender werden eingefroren
 * und das PDF wird abgelegt. „Bearbeiten“ macht ihn wieder zum Entwurf, die Nummer
 * bleibt; eine schon verschickte Fassung wird dabei archiviert. Verschickte oder
 * bezahlte Rechnungen werden nie gelöscht – dafür gibt es die Stornorechnung.
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
async function nextNumber(type: DocType, issueDate: string) {
	const r = await getSetting('rechnung');
	const year = issueDate.slice(0, 4);
	const key = `${type}-${year}`;
	const [row] = await db
		.insert(sequences)
		.values({ key, last: 1 })
		.onConflictDoUpdate({ target: sequences.key, set: { last: sql`${sequences.last} + 1` } })
		.returning({ last: sequences.last });
	return { number: documentNumber(type === 'angebot' ? r.quotePrefix : r.invoicePrefix, year, row.last, r.digits), seqKey: key, seq: row.last };
}

/** Nummer eines gelöschten Belegs: war sie die letzte und nie verschickt, wird sie wieder frei – sonst bleibt die Lücke */
async function releaseNumber(key: string, seq: number, sent: boolean) {
	const [s] = await db.select().from(sequences).where(eq(sequences.key, key));
	if (!s) return;
	if (sent) {
		await db.update(sequences).set({ floor: Math.max(s.floor, seq) }).where(eq(sequences.key, key));
		return;
	}
	if (seq !== s.last) return;
	const [{ top }] = await db.select({ top: max(documents.seq) }).from(documents).where(eq(documents.seqKey, key));
	await db.update(sequences).set({ last: Math.max(s.floor, top ?? 0) }).where(eq(sequences.key, key));
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
	// wieder geöffnete Belege behalten ihre Nummer
	const next = doc.number ? null : await nextNumber(doc.type, doc.issueDate);
	const number = doc.number ?? next!.number;
	const recipient = await recipientOf(doc.customerId);
	const sender = await senderNow();
	const finalizedAt = new Date().toISOString();
	await db
		.update(documents)
		.set({ number, ...(next && { seqKey: next.seqKey, seq: next.seq }), status: 'offen', recipient: JSON.stringify(recipient), sender: JSON.stringify(sender), finalizedAt, updatedAt: finalizedAt })
		.where(eq(documents.id, id));
	const pdf = await documentPdf(id);
	const file = `${number.replace(/[^\w-]/g, '_')}.pdf`;
	await fs.writeFile(path.join(DOCS_DIR, file), pdf);
	await db.update(documents).set({ pdfFile: file }).where(eq(documents.id, id));
	await logActivity({
		customerId: doc.customerId,
		projectId: doc.projectId,
		kind: doc.type,
		title: `${typeLabel(doc.type)} ${number} ${next ? '' : 'erneut '}festgeschrieben (${money(doc.grossCents)})`,
		meta: { documentId: id }
	});
	return number;
}

/** Festgeschriebenen Beleg wieder zum Entwurf machen – die Nummer bleibt, eine verschickte Fassung wird archiviert */
export async function reopenDocument(id: number): Promise<void> {
	const loaded = await loadDocument(id);
	if (!loaded) throw new Error('Beleg nicht gefunden');
	const { doc } = loaded;
	if (doc.status === 'entwurf') return;
	if (doc.cancelsId) throw new Error('Stornorechnungen lassen sich nicht bearbeiten.');
	if (doc.status === 'storniert') throw new Error('Stornierte Rechnungen lassen sich nicht mehr bearbeiten.');
	const now = new Date().toISOString();
	let archived: string | null = null;
	if (doc.pdfFile) {
		const file = path.join(DOCS_DIR, doc.pdfFile);
		if (doc.sentAt) {
			archived = `${doc.pdfFile.replace(/\.pdf$/, '')}_fassung_${today(new Date(now))}_${time(now).replace(':', '')}.pdf`;
			await fs.rename(file, path.join(DOCS_DIR, archived)).catch(() => (archived = null));
		} else await fs.rm(file, { force: true });
	}
	await db
		.update(documents)
		.set({ status: 'entwurf', pdfFile: null, recipient: null, sender: null, finalizedAt: null, paidAt: null, decidedAt: null, updatedAt: now })
		.where(eq(documents.id, id));
	await logActivity({
		customerId: doc.customerId,
		projectId: doc.projectId,
		kind: doc.type,
		title: `${typeLabel(doc.type)} ${doc.number} zur Bearbeitung geöffnet${archived ? ` (verschickte Fassung archiviert: ${archived})` : ''}`,
		meta: { documentId: id }
	});
}

/**
 * Link für den Kunden: Angebot auf der Webseite ansehen, annehmen oder Änderungen
 * anfragen (astronox.dev/angebot/…). Entsteht beim ersten Festschreiben.
 */
export async function quoteLink(doc: Pick<DocumentRow, 'id' | 'type' | 'status' | 'publicToken'>): Promise<string | null> {
	if (doc.type !== 'angebot') return null;
	let token = doc.publicToken;
	if (!token) {
		if (doc.status === 'entwurf') return null;
		token = randomBytes(18).toString('base64url');
		await db.update(documents).set({ publicToken: token }).where(eq(documents.id, doc.id));
	}
	return `${websiteUrl()}/angebot/${token}`;
}

/** Zusagen und Änderungswünsche, die über den Link gekommen sind */
export async function quoteAnswers(documentId: number) {
	try {
		return await db.select().from(quoteResponses).where(eq(quoteResponses.documentId, documentId)).orderBy(asc(quoteResponses.id));
	} catch {
		// Webseite noch ohne diese Tabelle
		return [];
	}
}

/** Warum ein Beleg nicht gelöscht werden darf – null heißt: darf */
export function deleteBlocker(doc: Pick<DocumentRow, 'type' | 'status' | 'cancelsId' | 'sentAt'>): string | null {
	if (doc.type === 'angebot') return null;
	if (doc.cancelsId) return 'Stornorechnungen werden aufbewahrt.';
	if (doc.status === 'storniert') return 'Stornierte Rechnungen werden zusammen mit ihrem Storno aufbewahrt.';
	if (doc.status === 'bezahlt') return 'Bezahlte Rechnungen werden aufbewahrt. Zum Ändern: Bearbeiten oder Stornieren.';
	if (doc.sentAt) return 'Verschickte Rechnungen musst du 7 Jahre aufbewahren. Zum Ändern: Bearbeiten oder Stornieren.';
	return null;
}

/** Beleg samt PDF löschen; abgerechnete Zeiten werden wieder frei */
export async function deleteDocument(id: number): Promise<void> {
	const loaded = await loadDocument(id);
	if (!loaded) throw new Error('Beleg nicht gefunden');
	const { doc } = loaded;
	const blocker = deleteBlocker(doc);
	if (blocker) throw new Error(blocker);
	await db.delete(documents).where(eq(documents.id, id));
	if (doc.pdfFile) await fs.rm(path.join(DOCS_DIR, doc.pdfFile), { force: true });
	if (doc.seqKey && doc.seq != null) await releaseNumber(doc.seqKey, doc.seq, !!doc.sentAt);
	if (doc.number) {
		await logActivity({
			customerId: doc.customerId,
			projectId: doc.projectId,
			kind: doc.type,
			title: `${typeLabel(doc.type)} ${doc.number} gelöscht (${money(doc.grossCents)})`
		});
	}
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
