import { and, asc, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { date } from '$lib/shared/format';
import { db } from '$lib/server/db';
import { customers, documents } from '$lib/server/db/schema';
import { documentPdf, pdfName } from '$lib/server/documents';
import { zip } from '$lib/server/zip';
import type { RequestHandler } from './$types';

/**
 * Export für die Steuerberatung: alle festgeschriebenen Rechnungen eines Jahres
 * (optional eines Quartals) als CSV (Excel-tauglich, Semikolon, UTF-8 mit BOM)
 * oder als ZIP mit allen PDFs und der CSV.
 */
export const GET: RequestHandler = async ({ url }) => {
	const year = /^\d{4}$/.test(url.searchParams.get('jahr') ?? '') ? url.searchParams.get('jahr')! : String(new Date().getFullYear());
	const q = Number(url.searchParams.get('quartal'));
	const from = q >= 1 && q <= 4 ? `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01` : `${year}-01-01`;
	const to = q >= 1 && q <= 4 ? `${year}-${String(q * 3).padStart(2, '0')}-31` : `${year}-12-31`;
	const rows = await db
		.select({ d: documents, customer: customers.name, vatId: customers.vatId })
		.from(documents)
		.innerJoin(customers, eq(customers.id, documents.customerId))
		.where(and(eq(documents.type, 'rechnung'), isNotNull(documents.number), gte(documents.issueDate, from), lte(documents.issueDate, to)))
		.orderBy(asc(documents.number));

	const euro = (c: number) => (c / 100).toFixed(2).replace('.', ',');
	const cell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
	const header = ['Nummer', 'Datum', 'Kunde', 'UID Kunde', 'Titel', 'Leistungszeitraum', 'Netto', 'USt-Satz', 'USt', 'Brutto', 'Status', 'Bezahlt am', 'Storno zu'];
	const byId = new Map(rows.map((r) => [r.d.id, r.d.number]));
	const lines = rows.map(({ d, customer, vatId }) =>
		[
			d.number!,
			date(d.issueDate),
			customer,
			vatId ?? '',
			d.title,
			d.servicePeriod ?? '',
			euro(d.netCents),
			d.taxMode === 'ust' ? `${d.taxRate} %` : 'Kleinunternehmer',
			euro(d.taxCents),
			euro(d.grossCents),
			d.status,
			d.paidAt ? date(d.paidAt) : '',
			d.cancelsId ? (byId.get(d.cancelsId) ?? '') : ''
		]
			.map(cell)
			.join(';')
	);
	const csv = Buffer.from(`﻿${[header.join(';'), ...lines].join('\r\n')}\r\n`, 'utf8');
	const name = `Rechnungen-${year}${q >= 1 && q <= 4 ? `-Q${q}` : ''}`;

	if (url.searchParams.get('format') === 'zip') {
		const entries: { name: string; data: Buffer }[] = [{ name: `${name}.csv`, data: csv }];
		for (const { d } of rows) entries.push({ name: pdfName(d), data: await documentPdf(d.id) });
		return new Response(new Uint8Array(zip(entries)), {
			headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name}.zip"` }
		});
	}
	return new Response(new Uint8Array(csv), {
		headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` }
	});
};
