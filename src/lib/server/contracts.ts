import { and, asc, desc, eq, inArray, lt, lte, type SQL } from 'drizzle-orm';
import { duePeriods, earliestEnd, periodFrom, proratedCents, prorationNote, type BillingPeriod } from '$lib/shared/billing';
import { date, monthLabel, money, today } from '$lib/shared/format';
import { CONTRACT_KIND_IDS, contractKindOf, INTERVALS, intervalOf, type ContractKind, type IntervalId } from '$lib/shared/stages';
import { logActivity, notify } from './activity';
import { primaryRecipient } from './customers';
import { db } from './db';
import { contractBillings, contractItems, contracts, customers, documents, mailTemplates, type Contract, type ContractItem } from './db/schema';
import { createDocument, documentPdf, finalize, pdfName } from './documents';
import { bad, type Fields } from './forms';
import { fillTemplate, greeting, sendMail, smtpReady } from './mail';
import type { Owner } from './panels';
import { getSetting } from './settings';

/**
 * Hosting-, Wartungs- und Supportverträge mit Monatsrechnung.
 *
 * Einmal am Tag (und auf Knopfdruck) werden alle fälligen Zeiträume
 * abgerechnet: je Kunde EINE Sammelrechnung mit allen fälligen Verträgen.
 * Sind alle Verträge darauf auf „automatisch senden“ gestellt, wird die
 * Rechnung festgeschrieben und mit PDF an den Kunden gemailt – sonst bleibt
 * sie ein Entwurf zum Prüfen.
 */

export type ContractWithItems = Contract & { items: ContractItem[] };

export async function withItems(rows: Contract[]): Promise<ContractWithItems[]> {
	if (!rows.length) return [];
	const items = await db
		.select()
		.from(contractItems)
		.where(
			inArray(
				contractItems.contractId,
				rows.map((r) => r.id)
			)
		)
		.orderBy(asc(contractItems.position), asc(contractItems.id));
	return rows.map((r) => ({ ...r, items: items.filter((i) => i.contractId === r.id) }));
}

/** Abrechnungsverlauf eines oder mehrerer Verträge, neueste zuerst */
export async function billingsOf(contractIds: number[]) {
	if (!contractIds.length) return [];
	return db
		.select({ b: contractBillings, number: documents.number, status: documents.status })
		.from(contractBillings)
		.leftJoin(documents, eq(documents.id, contractBillings.documentId))
		.where(inArray(contractBillings.contractId, contractIds))
		.orderBy(desc(contractBillings.periodFrom))
		.then((rows) => rows.map((r) => ({ ...r.b, number: r.number, status: r.status })));
}

/* ------------------------------------------------------------------ Speichern */

interface ItemInput {
	title: string;
	description?: string | null;
	quantity: number;
	unit: string;
	unitPriceCents: number;
}

function readItems(f: Fields): ItemInput[] {
	let raw: unknown;
	try {
		raw = JSON.parse(f.str('items', 100_000) ?? '[]');
	} catch {
		return bad('Die Positionen konnten nicht gelesen werden.');
	}
	if (!Array.isArray(raw)) return bad('Die Positionen konnten nicht gelesen werden.');
	const items = raw
		.map((it: Partial<ItemInput>) => ({
			title: String(it.title ?? '')
				.trim()
				.slice(0, 300),
			description: String(it.description ?? '').trim().slice(0, 2000) || null,
			quantity: Number.isFinite(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1,
			unit: String(it.unit || 'Pauschale').slice(0, 30),
			unitPriceCents: Math.round(Number(it.unitPriceCents) || 0)
		}))
		.filter((it) => it.title);
	if (!items.length) bad('Bitte mindestens eine Position mit Bezeichnung angeben.');
	return items;
}

/**
 * Vertrag anlegen oder ändern. Beim Kunden darf ein Projekt gewählt werden,
 * auf der Projektseite gehört der Vertrag immer zum Projekt.
 */
export async function saveContract(o: Owner, f: Fields, scope?: SQL) {
	const id = f.id('id');
	const items = readItems(f);
	const startDate = f.day('startDate') ?? today();
	const interval = f.oneOf<IntervalId>(
		'interval',
		INTERVALS.map((i) => i.id),
		'monat'
	);
	const kind = f.oneOf<ContractKind>('kind', [...CONTRACT_KIND_IDS], 'hosting');
	const amountCents = items.reduce((s, it) => s + Math.round(it.quantity * it.unitPriceCents), 0);
	const endDate = f.day('endDate');
	if (endDate && endDate < startDate) bad('Das Vertragsende liegt vor dem Beginn.');
	const values = {
		kind,
		title: f.str('title', 200) ?? contractKindOf(kind).title,
		description: f.str('description', 2000),
		amountCents,
		interval,
		startDate,
		endDate,
		autoInvoice: f.bool('autoInvoice'),
		autoSend: f.bool('autoInvoice') && f.bool('autoSend'),
		minTermMonths: f.int('minTermMonths') || null,
		noticeMonths: f.int('noticeMonths') ?? null,
		cancelledOn: f.day('cancelledOn'),
		active: f.has('active') ? f.bool('active') : true,
		updatedAt: new Date().toISOString()
	};

	let contractId: number;
	if (id) {
		const [old] = await db.select().from(contracts).where(scope ? and(eq(contracts.id, id), scope) : eq(contracts.id, id));
		if (!old) bad('Vertrag nicht gefunden');
		// Noch nie abgerechnet: der Beginn bestimmt die erste Rechnung. Sonst bleibt der nächste Zeitraum, wie er ist.
		const [billed] = await db.select({ id: contractBillings.id }).from(contractBillings).where(eq(contractBillings.contractId, id)).limit(1);
		const next = f.day('nextInvoiceDate') ?? (billed ? old.nextInvoiceDate : startDate);
		await db
			.update(contracts)
			.set({ ...values, nextInvoiceDate: next, projectId: o.projectId ?? (f.has('projectId') ? f.id('projectId') : old.projectId) })
			.where(eq(contracts.id, id));
		contractId = id;
	} else {
		const [row] = await db
			.insert(contracts)
			.values({ ...values, customerId: o.customerId, projectId: o.projectId ?? f.id('projectId'), nextInvoiceDate: f.day('nextInvoiceDate') ?? startDate })
			.returning({ id: contracts.id });
		contractId = row.id;
		await logActivity({ ...o, kind: 'system', title: `${contractKindOf(kind).label}-Vertrag angelegt: ${values.title} (${money(amountCents)} ${intervalOf(interval).label})` });
	}
	await db.delete(contractItems).where(eq(contractItems.contractId, contractId));
	await db.insert(contractItems).values(items.map((it, i) => ({ ...it, contractId, position: i })));
	return { message: id ? 'Vertrag gespeichert' : 'Vertrag angelegt', id: contractId };
}

/** Kündigung erfassen: Ende = frühestmöglicher Termin, sofern nicht selbst angegeben */
export async function cancelContract(id: number, cancelledOn: string, endDate: string | null, scope?: SQL) {
	const [c] = await db.select().from(contracts).where(scope ? and(eq(contracts.id, id), scope) : eq(contracts.id, id));
	if (!c) bad('Vertrag nicht gefunden');
	const end = endDate ?? earliestEnd(c.startDate, cancelledOn, c.noticeMonths, c.minTermMonths);
	await db.update(contracts).set({ cancelledOn, endDate: end, updatedAt: new Date().toISOString() }).where(eq(contracts.id, id));
	await logActivity({ customerId: c.customerId, projectId: c.projectId, kind: 'system', title: `Vertrag gekündigt: ${c.title} – endet am ${date(end)}` });
	return { message: `Gekündigt – endet am ${date(end)}` };
}

/** Kündigung zurücknehmen */
export async function revokeCancellation(id: number, scope?: SQL) {
	const [c] = await db.select().from(contracts).where(scope ? and(eq(contracts.id, id), scope) : eq(contracts.id, id));
	if (!c) bad('Vertrag nicht gefunden');
	await db.update(contracts).set({ cancelledOn: null, endDate: null, active: true, updatedAt: new Date().toISOString() }).where(eq(contracts.id, id));
	return { message: 'Kündigung zurückgenommen' };
}

/* ------------------------------------------------------------------ Abrechnen */

interface Line {
	contract: ContractWithItems;
	period: BillingPeriod;
}

const KIND_ORDER: ContractKind[] = ['hosting', 'wartung', 'support', 'sonstiges'];

/** „Hosting & Wartung – November 2026“ */
function invoiceTitle(lines: Line[]): string {
	const kinds = KIND_ORDER.filter((k) => lines.some((l) => l.contract.kind === k)).map((k) => (k === 'sonstiges' ? 'Laufende Leistungen' : contractKindOf(k).label));
	const what = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} & ${kinds.at(-1)}` : kinds[0];
	const from = lines.reduce((m, l) => (l.period.from < m ? l.period.from : m), lines[0].period.from);
	const to = lines.reduce((m, l) => (l.period.to > m ? l.period.to : m), lines[0].period.to);
	const span = from.slice(0, 7) === to.slice(0, 7) ? monthLabel(from.slice(0, 7)) : `${date(from)} – ${date(to)}`;
	return `${what} – ${span}`;
}

function invoiceItems(lines: Line[]) {
	return lines.flatMap(({ contract: c, period: p }) => {
		const months = intervalOf(c.interval).months;
		const note = prorationNote(p, months);
		return c.items.map((it) => ({
			title: it.title,
			description: [it.description, `Zeitraum ${date(p.from)} – ${date(p.to)}${note ? `, ${note}` : ''}`].filter(Boolean).join('\n'),
			quantity: it.quantity,
			unit: it.unit,
			unitPriceCents: proratedCents(it.unitPriceCents, p)
		}));
	});
}

export interface RunResult {
	invoices: number;
	sent: number;
	drafts: number;
}

/** Warum eine Rechnung nicht automatisch rausgehen kann (oder null) */
async function cannotSend(customerId: number): Promise<string | null> {
	const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
	if (!c?.street) return 'beim Kunden die Anschrift fehlt';
	const rec = await primaryRecipient(customerId);
	if (!rec?.email) return 'beim Kunden keine E-Mail-Adresse hinterlegt ist';
	if (!(await smtpReady())) return 'noch kein SMTP-Zugang eingerichtet ist (Einstellungen → E-Mail)';
	const firma = await getSetting('firma');
	if (!firma.street || !firma.city) return 'im Briefkopf deine Anschrift fehlt (Einstellungen → Allgemein)';
	return null;
}

/** Festgeschriebene Rechnung mit PDF an den Kunden senden */
export async function mailInvoice(documentId: number): Promise<{ ok: boolean; error?: string }> {
	const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
	if (!doc?.number) return { ok: false, error: 'Rechnung ist nicht festgeschrieben' };
	const rec = await primaryRecipient(doc.customerId);
	if (!rec?.email) return { ok: false, error: 'keine E-Mail-Adresse beim Kunden' };
	const [tpl] = await db.select().from(mailTemplates).where(inArray(mailTemplates.key, ['vertragsrechnung', 'rechnung'])).orderBy(desc(mailTemplates.key));
	const values = {
		anrede: greeting(rec.salutationName),
		name: rec.name,
		nummer: doc.number,
		titel: doc.title,
		betrag: money(doc.grossCents),
		datum: date(doc.dueDate),
		zeitraum: doc.servicePeriod ?? ''
	};
	const subject = fillTemplate(tpl?.subject ?? 'Rechnung {{nummer}} – {{titel}}', values);
	const text = fillTemplate(tpl?.body ?? '{{anrede}}\n\nim Anhang finden Sie die Rechnung {{nummer}} über {{betrag}}, zahlbar bis {{datum}}.\n\nViele Grüße\nMatthias Streicher', values);
	const r = await sendMail({
		to: rec.email,
		subject,
		text,
		attachments: [{ filename: pdfName(doc), content: await documentPdf(doc.id), contentType: 'application/pdf' }],
		customerId: doc.customerId,
		projectId: doc.projectId,
		documentId: doc.id
	});
	if (r.ok) await db.update(documents).set({ sentAt: new Date().toISOString() }).where(eq(documents.id, doc.id));
	return { ok: r.ok, error: r.error };
}

let running: Promise<RunResult> | null = null;

/**
 * Alle fälligen Zeiträume abrechnen (bis einschließlich `day`). Läuft nie
 * doppelt gleichzeitig; jeder Zeitraum wird genau einmal abgerechnet, weil
 * „nächste Rechnung ab“ im selben Schritt weiterrückt.
 */
export function billContracts(day = today()): Promise<RunResult> {
	running ??= run(day).finally(() => (running = null));
	return running;
}

async function run(day: string): Promise<RunResult> {
	const result: RunResult = { invoices: 0, sent: 0, drafts: 0 };

	// Abgelaufene Verträge stilllegen
	await db
		.update(contracts)
		.set({ active: false, updatedAt: new Date().toISOString() })
		.where(and(eq(contracts.active, true), lt(contracts.endDate, day)));

	const due = await withItems(
		await db
			.select()
			.from(contracts)
			.where(and(eq(contracts.active, true), eq(contracts.autoInvoice, true), lte(contracts.nextInvoiceDate, day)))
			.orderBy(asc(contracts.customerId), asc(contracts.id))
	);

	const byCustomer = new Map<number, Line[]>();
	const advance = new Map<number, string>();
	for (const c of due) {
		if (!c.items.length) continue;
		const periods = duePeriods(c.nextInvoiceDate, intervalOf(c.interval).months, c.endDate, day);
		if (!periods.length) continue;
		const lines = byCustomer.get(c.customerId) ?? [];
		for (const p of periods) lines.push({ contract: c, period: p });
		byCustomer.set(c.customerId, lines);
		advance.set(c.id, periods.at(-1)!.next);
	}

	for (const [customerId, lines] of byCustomer) {
		const contractIds = [...new Set(lines.map((l) => l.contract.id))];
		const projectIds = [...new Set(lines.map((l) => l.contract.projectId))];
		const from = lines.reduce((m, l) => (l.period.from < m ? l.period.from : m), lines[0].period.from);
		const to = lines.reduce((m, l) => (l.period.to > m ? l.period.to : m), lines[0].period.to);
		const id = await createDocument({
			type: 'rechnung',
			customerId,
			projectId: projectIds.length === 1 ? projectIds[0] : null,
			contractId: contractIds.length === 1 ? contractIds[0] : null,
			title: invoiceTitle(lines),
			servicePeriod: `${date(from)} – ${date(to)}`,
			issueDate: day,
			items: invoiceItems(lines)
		});
		// Zeiträume festhalten und weiterrücken, bevor irgendetwas schiefgehen kann
		await db.insert(contractBillings).values(
			lines.map((l) => ({
				contractId: l.contract.id,
				documentId: id,
				periodFrom: l.period.from,
				periodTo: l.period.to,
				amountCents: l.contract.items.reduce((s, it) => s + Math.round(it.quantity * proratedCents(it.unitPriceCents, l.period)), 0)
			}))
		);
		for (const cid of contractIds) {
			await db.update(contracts).set({ nextInvoiceDate: advance.get(cid)!, updatedAt: new Date().toISOString() }).where(eq(contracts.id, cid));
		}
		result.invoices++;

		const [customer] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, customerId));
		const [doc] = await db.select({ grossCents: documents.grossCents }).from(documents).where(eq(documents.id, id));
		const label = `${customer.name} · ${money(doc.grossCents)}`;
		const automatic = lines.every((l) => l.contract.autoSend);
		if (!automatic) {
			result.drafts++;
			await notify({ kind: 'rechnung', title: 'Vertragsrechnung zum Prüfen', body: `${label} – Entwurf`, url: `/rechnungen/${id}` });
			continue;
		}
		const reason = await cannotSend(customerId);
		if (reason) {
			result.drafts++;
			await notify({ kind: 'rechnung', title: 'Vertragsrechnung nicht automatisch gesendet', body: `${label} – bleibt Entwurf, weil ${reason}.`, url: `/rechnungen/${id}` });
			continue;
		}
		try {
			const number = await finalize(id);
			const mail = await mailInvoice(id);
			if (mail.ok) {
				result.sent++;
				await notify({ kind: 'rechnung', title: `Rechnung ${number} gesendet`, body: label, url: `/rechnungen/${id}`, push: false });
			} else {
				await notify({ kind: 'rechnung', title: `Rechnung ${number}: Versand fehlgeschlagen`, body: `${label} – festgeschrieben, aber nicht gesendet: ${mail.error}. Bitte manuell senden.`, url: `/rechnungen/${id}` });
			}
		} catch (err) {
			await notify({ kind: 'rechnung', title: 'Vertragsrechnung: Fehler beim Festschreiben', body: `${label} – ${(err as Error).message}`, url: `/rechnungen/${id}` });
		}
	}

	return result;
}

/* ------------------------------------------------------------------ Vorschau */

export interface Upcoming {
	date: string;
	customerId: number;
	customer: string;
	netCents: number;
	automatic: boolean;
	contracts: { id: number; title: string; kind: string }[];
}

/** Die nächsten Rechnungen, wie sie der Lauf erzeugen würde – je Tag und Kunde */
export async function upcomingInvoices(limit = 12): Promise<Upcoming[]> {
	const day = today();
	const rows = await withItems(await db.select().from(contracts).where(and(eq(contracts.active, true), eq(contracts.autoInvoice, true))));
	const names = new Map((await db.select({ id: customers.id, name: customers.name }).from(customers)).map((c) => [c.id, c.name]));
	const groups = new Map<string, Upcoming>();
	for (const c of rows) {
		const start = c.nextInvoiceDate < day ? day : c.nextInvoiceDate;
		const p = periodFrom(c.nextInvoiceDate, intervalOf(c.interval).months, c.endDate);
		if (!p) continue;
		const key = `${start}|${c.customerId}`;
		const g = groups.get(key) ?? { date: start, customerId: c.customerId, customer: names.get(c.customerId) ?? '–', netCents: 0, automatic: true, contracts: [] };
		g.netCents += c.items.reduce((s, it) => s + Math.round(it.quantity * proratedCents(it.unitPriceCents, p)), 0);
		g.automatic &&= c.autoSend;
		g.contracts.push({ id: c.id, title: c.title, kind: c.kind });
		groups.set(key, g);
	}
	return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.customer.localeCompare(b.customer)).slice(0, limit);
}
