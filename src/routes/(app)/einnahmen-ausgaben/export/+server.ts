import fs from 'node:fs/promises';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { categoryOf, KZ_LABELS, PAYMENT_METHODS } from '$lib/shared/ear';
import { date, today } from '$lib/shared/format';
import { db } from '$lib/server/db';
import { assets, documents, ledgerEntries } from '$lib/server/db/schema';
import { documentPdf, pdfName } from '$lib/server/documents';
import { receiptPath, summarize, yearRows } from '$lib/server/ear';
import { zip } from '$lib/server/zip';
import type { RequestHandler } from './$types';

/**
 * Export für die Steuerberatung: alle Einnahmen und Ausgaben eines Jahres als
 * CSV (Excel-tauglich: Semikolon, UTF-8 mit BOM) samt Übersicht nach E1a-Kennzahl –
 * oder als ZIP mit beiden Tabellen, allen Belegen und den Rechnungs-PDFs.
 */
export const GET: RequestHandler = async ({ url }) => {
	const year = /^\d{4}$/.test(url.searchParams.get('jahr') ?? '') ? url.searchParams.get('jahr')! : today().slice(0, 4);
	const rows = await yearRows(year);
	const s = summarize(rows);

	const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',');
	const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
	const csv = (lines: string[][]) => Buffer.from(`﻿${lines.map((l) => l.map(cell).join(';')).join('\r\n')}\r\n`, 'utf8');
	const pay = (id: string | null) => PAYMENT_METHODS.find((p) => p.id === id)?.label ?? '';

	// Belegdateien im ZIP: Datum_Beschreibung_Nummer.ext
	const receiptName = (r: (typeof rows)[number], original: string) =>
		`Belege/${r.date}_${r.description.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 50)}_${r.key}${path.extname(original).toLowerCase()}`;

	const manualIds = rows.filter((r) => r.source === 'buchung' && r.receipt).map((r) => r.id);
	const assetIds = rows.filter((r) => r.source === 'afa' && r.receipt).map((r) => r.id);
	const [entryFiles, assetFiles] = await Promise.all([
		manualIds.length ? db.select({ id: ledgerEntries.id, file: ledgerEntries.receiptFile, name: ledgerEntries.receiptName }).from(ledgerEntries).where(inArray(ledgerEntries.id, manualIds)) : [],
		assetIds.length ? db.select({ id: assets.id, file: assets.receiptFile, name: assets.receiptName }).from(assets).where(inArray(assets.id, assetIds)) : []
	]);
	const fileOf = (r: (typeof rows)[number]) => (r.source === 'buchung' ? entryFiles : r.source === 'afa' ? assetFiles : []).find((x) => x.id === r.id);

	const journal = csv([
		['Datum', 'Art', 'Kennzahl E1a', 'Kategorie', 'Beschreibung', 'Partner', 'Netto', 'USt-Satz', 'USt / Vorsteuer', 'Brutto', 'Zahlungsart', 'Beleg', 'Quelle'],
		...rows.map((r) => {
			const c = categoryOf(r.category);
			const f = fileOf(r);
			return [
				date(r.date),
				r.kind === 'einnahme' ? 'Einnahme' : 'Ausgabe',
				c.kz,
				c.label,
				r.description,
				r.party ?? '',
				euro(r.netCents),
				r.taxCents ? `${r.taxRate} %` : '',
				euro(r.taxCents),
				euro(r.grossCents),
				pay(r.paymentMethod),
				r.source === 'rechnung' ? 'Rechnungs-PDF' : f?.file ? receiptName(r, f.name ?? f.file) : r.source === 'buchung' && r.kind === 'ausgabe' ? 'fehlt' : '',
				r.source === 'rechnung' ? 'Rechnung' : r.source === 'afa' ? 'Anlagenverzeichnis' : 'Buchung'
			];
		})
	]);
	const overview = csv([
		['Kennzahl E1a', 'Bezeichnung', 'Betrag'],
		...s.byKz.map((k) => [k.kz, KZ_LABELS[k.kz] ?? '', euro(k.cents)]),
		[],
		['', 'Summe Einnahmen', euro(s.income)],
		['', 'Summe Ausgaben', euro(s.expenses)],
		['', s.profit >= 0 ? 'Gewinn' : 'Verlust', euro(s.profit)],
		...(s.outputTax || s.inputTax ? [[], ['', 'Umsatzsteuer aus Einnahmen', euro(s.outputTax)], ['', 'Vorsteuer aus Ausgaben', euro(s.inputTax)]] : []),
		[],
		['', 'Kennzahlen laut Beilage E 1a 2025 – jedes Jahr mit dem aktuellen Formular abgleichen.', '']
	]);
	const name = `Einnahmen-Ausgaben-${year}`;

	if (url.searchParams.get('format') === 'zip') {
		const entries: { name: string; data: Buffer }[] = [
			{ name: `${name}.csv`, data: journal },
			{ name: `Uebersicht-E1a-${year}.csv`, data: overview }
		];
		for (const r of rows) {
			const f = fileOf(r);
			if (f?.file) {
				const data = await fs.readFile(receiptPath(f.file)).catch(() => null);
				if (data && !entries.some((e) => e.name === receiptName(r, f.name ?? f.file!))) entries.push({ name: receiptName(r, f.name ?? f.file), data });
			}
		}
		const invoiceIds = rows.filter((r) => r.source === 'rechnung').map((r) => r.id);
		if (invoiceIds.length) {
			for (const d of await db.select().from(documents).where(inArray(documents.id, invoiceIds))) {
				entries.push({ name: `Rechnungen/${pdfName(d)}`, data: await documentPdf(d.id) });
			}
		}
		return new Response(new Uint8Array(zip(entries)), {
			headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}.zip"` }
		});
	}
	const which = url.searchParams.get('format') === 'uebersicht' ? { data: overview, file: `Uebersicht-E1a-${year}.csv` } : { data: journal, file: `${name}.csv` };
	return new Response(new Uint8Array(which.data), {
		headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${which.file}"` }
	});
};
