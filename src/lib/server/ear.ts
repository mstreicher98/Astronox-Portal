import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { ABGANG, AFA, afaSchedule, categoryOf, split, type EntryKind } from '$lib/shared/ear';
import { addMonths, today } from '$lib/shared/format';
import { intervalOf } from '$lib/shared/stages';
import { notify } from './activity';
import { db, PORTAL_DIR } from './db';
import { assets, customers, documents, ledgerEntries, ledgerRecurring } from './db/schema';
import { bad } from './forms';
import { getSetting } from './settings';

/**
 * Einnahmen-Ausgaben-Rechnung: Buchungen von Hand, bezahlte Rechnungen aus dem
 * Portal (Zufluss am Zahltag) und die AfA aus dem Anlagenverzeichnis.
 */

export const EAR_DIR = path.join(PORTAL_DIR, 'ausgaben');
fs.mkdirSync(EAR_DIR, { recursive: true });

const MAX_RECEIPT = 20 * 1024 * 1024;

export interface Row {
	/** eindeutig je Quelle, z. B. „b12“, „r7“, „a3-2026“ */
	key: string;
	source: 'buchung' | 'rechnung' | 'afa';
	id: number;
	kind: EntryKind;
	date: string;
	description: string;
	party: string | null;
	category: string;
	grossCents: number;
	netCents: number;
	taxCents: number;
	taxRate: number;
	paymentMethod: string | null;
	receipt: boolean;
	notes: string | null;
	recurring: boolean;
}

/** USt-Pflicht laut Einstellungen (Regelbesteuerung) – sonst Kleinunternehmer */
export async function vatRegistered(): Promise<boolean> {
	return (await getSetting('rechnung')).taxMode === 'ust';
}

/** Alle Zeilen eines Jahres, nach Datum sortiert */
export async function yearRows(year: string): Promise<Row[]> {
	const from = `${year}-01-01`;
	const to = `${year}-12-31`;
	const rows: Row[] = [];

	for (const e of await db.select().from(ledgerEntries).where(and(gte(ledgerEntries.date, from), lte(ledgerEntries.date, to)))) {
		const { net, tax } = split(e.grossCents, e.taxRate, e.vat);
		rows.push({
			key: `b${e.id}`,
			source: 'buchung',
			id: e.id,
			kind: e.kind,
			date: e.date,
			description: e.description,
			party: e.party,
			category: e.category,
			grossCents: e.grossCents,
			netCents: net,
			taxCents: tax,
			taxRate: e.taxRate,
			paymentMethod: e.paymentMethod,
			receipt: !!e.receiptFile,
			notes: e.notes,
			recurring: !!e.recurringId
		});
	}

	// Bezahlte Rechnungen; Stornos nur, wenn die stornierte Rechnung bezahlt war (Rückzahlung)
	const invoices = await db
		.select({ d: documents, customer: customers.name })
		.from(documents)
		.innerJoin(customers, eq(customers.id, documents.customerId))
		.where(and(eq(documents.type, 'rechnung'), isNotNull(documents.number), isNotNull(documents.paidAt), gte(documents.paidAt, from), lte(documents.paidAt, to)));
	const cancelled = invoices.map((r) => r.d.cancelsId).filter((x): x is number => !!x);
	const paidOriginals = new Set(
		cancelled.length
			? (await db.select({ id: documents.id }).from(documents).where(and(inArray(documents.id, cancelled), isNotNull(documents.paidAt)))).map((r) => r.id)
			: []
	);
	for (const { d, customer } of invoices) {
		if (d.cancelsId && !paidOriginals.has(d.cancelsId)) continue;
		rows.push({
			key: `r${d.id}`,
			source: 'rechnung',
			id: d.id,
			kind: 'einnahme',
			date: d.paidAt!,
			description: `${d.cancelsId ? 'Rückzahlung zu Storno' : 'Rechnung'} ${d.number} – ${d.title}`,
			party: customer,
			category: 'erloese',
			grossCents: d.grossCents,
			netCents: d.netCents,
			taxCents: d.taxCents,
			taxRate: d.taxMode === 'ust' ? d.taxRate : 0,
			paymentMethod: 'bank',
			receipt: true,
			notes: null,
			recurring: false
		});
	}

	// AfA und Restbuchwerte aus dem Anlagenverzeichnis
	for (const a of await db.select().from(assets)) {
		const y = afaSchedule(a).find((s) => s.year === Number(year));
		if (!y) continue;
		const base = { source: 'afa' as const, id: a.id, kind: 'ausgabe' as const, party: null, taxRate: 0, paymentMethod: null, receipt: !!a.receiptFile, notes: null, recurring: false };
		if (y.cents) rows.push({ ...base, key: `a${a.id}-${year}`, date: `${year}-12-31`, description: `AfA ${a.name}`, category: AFA.id, grossCents: y.cents, netCents: y.cents, taxCents: 0 });
		if (y.disposal) rows.push({ ...base, key: `x${a.id}-${year}`, date: a.disposedOn!, description: `Restbuchwert ${a.name}`, category: ABGANG.id, grossCents: y.disposal, netCents: y.disposal, taxCents: 0 });
	}

	return rows.sort((x, y) => (x.date === y.date ? x.key.localeCompare(y.key) : x.date.localeCompare(y.date)));
}

export interface Summary {
	income: number;
	expenses: number;
	profit: number;
	/** USt aus Einnahmen und Vorsteuer aus Ausgaben (nur mit USt-Pflicht) */
	outputTax: number;
	inputTax: number;
	missingReceipts: number;
	months: { income: number; expenses: number }[];
	/** je Kennzahl mit den Kategorien darin */
	byKz: { kz: string; kind: EntryKind; cents: number; categories: { id: string; label: string; cents: number }[] }[];
}

export function summarize(rows: Row[]): Summary {
	const s: Summary = { income: 0, expenses: 0, profit: 0, outputTax: 0, inputTax: 0, missingReceipts: 0, months: Array.from({ length: 12 }, () => ({ income: 0, expenses: 0 })), byKz: [] };
	const kz = new Map<string, Summary['byKz'][number]>();
	for (const r of rows) {
		const m = Number(r.date.slice(5, 7)) - 1;
		if (r.kind === 'einnahme') {
			s.income += r.netCents;
			s.outputTax += r.taxCents;
			s.months[m].income += r.netCents;
		} else {
			s.expenses += r.netCents;
			s.inputTax += r.taxCents;
			s.months[m].expenses += r.netCents;
			if (r.source === 'buchung' && !r.receipt) s.missingReceipts++;
		}
		const c = categoryOf(r.category);
		const k = kz.get(c.kz) ?? { kz: c.kz, kind: c.kind, cents: 0, categories: [] };
		k.cents += r.netCents;
		const cat = k.categories.find((x) => x.id === c.id) ?? (k.categories.push({ id: c.id, label: c.label, cents: 0 }), k.categories.at(-1)!);
		cat.cents += r.netCents;
		kz.set(c.kz, k);
	}
	s.profit = s.income - s.expenses;
	s.byKz = [...kz.values()].sort((a, b) => (a.kind === b.kind ? a.kz.localeCompare(b.kz) : a.kind === 'einnahme' ? -1 : 1));
	return s;
}

/** Jahre mit Daten (und das laufende), neueste zuerst */
export async function years(): Promise<string[]> {
	const [e, d, a] = await Promise.all([
		db.selectDistinct({ y: ledgerEntries.date }).from(ledgerEntries),
		db.selectDistinct({ y: documents.paidAt }).from(documents).where(isNotNull(documents.paidAt)),
		db.select({ start: assets.startDate }).from(assets)
	]);
	const set = new Set([today().slice(0, 4), ...e.map((r) => r.y.slice(0, 4)), ...d.map((r) => r.y!.slice(0, 4)), ...a.map((r) => r.start.slice(0, 4))]);
	return [...set].sort().reverse();
}

/* ------------------------------------------------------------------ Belege */

export async function saveReceipt(file: File) {
	if (file.size > MAX_RECEIPT) bad(`„${file.name}“ ist größer als 20 MB.`);
	if (!/^(image\/|application\/pdf$)/.test(file.type)) bad('Belege bitte als Foto oder PDF.');
	const name = file.name.replace(/[/\\]/g, '_').slice(0, 200) || 'beleg';
	const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
	const stored = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`;
	await fsp.writeFile(path.join(EAR_DIR, stored), Buffer.from(await file.arrayBuffer()));
	return { receiptFile: stored, receiptName: name, receiptMime: file.type, receiptSize: file.size };
}

export const receiptPath = (stored: string) => path.join(EAR_DIR, path.basename(stored));

export async function removeReceipt(stored: string | null | undefined) {
	if (stored) await fsp.rm(receiptPath(stored), { force: true });
}

/* ------------------------------------------------------------------ Wiederkehrende Ausgaben */

/** Fällige wiederkehrende Ausgaben buchen (täglich und per Knopf) */
export async function bookRecurring(day = today()): Promise<number> {
	const vat = await vatRegistered();
	const due = await db
		.select()
		.from(ledgerRecurring)
		.where(and(eq(ledgerRecurring.active, true), lte(ledgerRecurring.nextDate, day)))
		.orderBy(asc(ledgerRecurring.nextDate));
	let booked = 0;
	for (const r of due) {
		let next = r.nextDate;
		for (let i = 0; i < 36 && next <= day && (!r.endDate || next <= r.endDate); i++) {
			await db.insert(ledgerEntries).values({
				kind: 'ausgabe',
				date: next,
				description: r.description,
				party: r.party,
				category: r.category,
				grossCents: r.grossCents,
				taxRate: r.taxRate,
				vat,
				paymentMethod: r.paymentMethod,
				recurringId: r.id
			});
			booked++;
			next = addMonths(next, intervalOf(r.interval).months);
		}
		const ended = !!r.endDate && next > r.endDate;
		await db.update(ledgerRecurring).set({ nextDate: next, active: !ended }).where(eq(ledgerRecurring.id, r.id));
	}
	if (booked) {
		await notify({ kind: 'rechnung', title: `${booked} wiederkehrende ${booked === 1 ? 'Ausgabe' : 'Ausgaben'} gebucht`, body: 'Belege dazu bei Gelegenheit hochladen.', url: '/einnahmen-ausgaben?tab=buchungen', push: false });
	}
	return booked;
}
