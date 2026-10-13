import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';
import { date, money, number } from '$lib/shared/format';
import type { FirmaSettings } from '$lib/shared/settings';
import type { DocumentItem, DocumentRow } from './db/schema';
import type { Party } from './documents';

/**
 * Angebote und Rechnungen als PDF (A4, Fensterkuvert nach DIN 5008 Form B).
 * Schrift: Instrument Sans – dieselbe wie im Portal und auf der Webseite.
 *
 * Pflichtangaben einer Rechnung in Österreich (§ 11 UStG): Name und Anschrift
 * von Absender und Empfänger, Ausstellungsdatum, fortlaufende Nummer, Menge und
 * Bezeichnung der Leistung, Leistungszeitraum, Entgelt und Steuersatz bzw. der
 * Hinweis auf die Kleinunternehmerregelung, ab € 10.000 die UID des Empfängers.
 */

const require = createRequire(import.meta.url);
const font = (w: number) => require.resolve(`@fontsource/instrument-sans/files/instrument-sans-latin-${w}-normal.woff`);

const C = {
	ink: '#141a33',
	muted: '#5d6485',
	faint: '#9aa0b8',
	line: '#e3e6ef',
	soft: '#f4f5fa',
	night: '#0b1330',
	teal: '#5eead4',
	nebula: '#8f9bff',
	violet: '#b197fc',
	pink: '#f472b6'
};

const STAR = 'M24 4.5c1.3 11.2 5.6 16.2 19.5 19.5C29.6 27.3 25.3 32.3 24 43.5 22.7 32.3 18.4 27.3 4.5 24 18.4 20.7 22.7 15.7 24 4.5Z';

export interface PdfInput {
	doc: DocumentRow;
	items: DocumentItem[];
	recipient: Party;
	sender: FirmaSettings;
	kleinText: string;
	cancels: string | null;
}

const mm = (v: number) => v * 2.8346;

export function renderPdf(input: PdfInput): Promise<Buffer> {
	const { doc, items, recipient, sender: s, kleinText, cancels } = input;
	const isQuote = doc.type === 'angebot';
	const draft = doc.status === 'entwurf';
	const kind = isQuote ? 'Angebot' : cancels ? 'Stornorechnung' : 'Rechnung';

	const pdf = new PDFDocument({
		size: 'A4',
		margins: { top: mm(20), bottom: mm(28), left: mm(22), right: mm(20) },
		bufferPages: true,
		info: { Title: `${kind} ${doc.number ?? '(Entwurf)'}`, Author: s.name, Creator: 'Astronox Portal' },
		lang: 'de-AT'
	});
	pdf.registerFont('r', font(400));
	pdf.registerFont('m', font(500));
	pdf.registerFont('b', font(600));
	pdf.registerFont('x', font(700));

	const chunks: Buffer[] = [];
	pdf.on('data', (c: Buffer) => chunks.push(c));
	const done = new Promise<Buffer>((resolve) => pdf.on('end', () => resolve(Buffer.concat(chunks))));

	const W = pdf.page.width;
	const L = pdf.page.margins.left;
	const R = W - pdf.page.margins.right;
	const bottom = pdf.page.height - pdf.page.margins.bottom;

	/* ---------- Kopf */
	const bar = pdf.linearGradient(0, 0, W, 0);
	bar.stop(0, C.teal).stop(0.52, C.nebula).stop(1, C.pink);
	pdf.rect(0, 0, W, 5).fill(bar);

	// Bildmarke: Stern mit Umlaufbahn
	const markX = L;
	const markY = mm(14);
	pdf.save();
	pdf.translate(markX, markY).scale(36 / 48);
	pdf.save().rotate(-24, { origin: [24, 24] });
	pdf.path('M3 24 A21 7.5 0 0 1 45 24').lineWidth(2.2).strokeOpacity(0.55).stroke(C.violet);
	pdf.restore();
	const g = pdf.linearGradient(0, 0, 48, 48);
	g.stop(0, C.teal).stop(0.52, C.nebula).stop(1, C.pink);
	pdf.path(STAR).fill(g);
	pdf.save().rotate(-24, { origin: [24, 24] });
	pdf.path('M45 24 A21 7.5 0 0 1 3 24').lineWidth(2.2).strokeOpacity(1).stroke(C.violet);
	pdf.circle(38.85, 29.3, 3.1).lineWidth(1.6).fillAndStroke(C.night, '#ffffff');
	pdf.restore();
	pdf.restore();

	pdf.font('x').fontSize(17).fillColor(C.night).text('Astronox', markX + 46, markY + 6, { lineBreak: false, characterSpacing: 0.4 });
	pdf.font('r').fontSize(8.5).fillColor(C.muted).text('Development', markX + 46, markY + 25, { lineBreak: false, characterSpacing: 0.8 });

	// Absender rechts oben
	const senderLines = [s.owner && s.owner !== s.name ? s.owner : '', s.street, [s.zip, s.city].filter(Boolean).join(' '), s.email, s.phone, s.website].filter(Boolean);
	pdf.font('b').fontSize(8.5).fillColor(C.ink).text(s.name, R - 180, markY + 2, { width: 180, align: 'right' });
	pdf.font('r').fontSize(8.5).fillColor(C.muted).text(senderLines.join('\n'), R - 180, pdf.y + 1, { width: 180, align: 'right', lineGap: 1.2 });

	/* ---------- Anschrift im Fenster (45 mm von oben, 20 mm von links) */
	const winY = mm(45);
	const backLine = [s.name, s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
	pdf.font('r').fontSize(6.8).fillColor(C.faint).text(backLine, L, winY, { width: mm(85), lineBreak: false, ellipsis: true });
	pdf.font('b').fontSize(10.5).fillColor(C.ink).text(recipient.name, L, winY + mm(6), { width: mm(85) });
	pdf.font('r').fontSize(10).fillColor(C.ink).text(recipient.lines.join('\n'), L, pdf.y + 1, { width: mm(85), lineGap: 1.5 });
	if (recipient.vatId) pdf.font('r').fontSize(8.5).fillColor(C.muted).text(`UID: ${recipient.vatId}`, L, pdf.y + 3);

	/* ---------- Eckdaten rechts */
	const facts: [string, string][] = [
		[`${kind} Nr.`, doc.number ?? 'Entwurf'],
		['Datum', date(doc.issueDate)],
		...(doc.dueDate ? [[isQuote ? 'Gültig bis' : 'Fällig am', date(doc.dueDate)] as [string, string]] : []),
		...(doc.servicePeriod ? [['Leistungszeitraum', doc.servicePeriod] as [string, string]] : []),
		['Kunden-Nr.', `K-${String(doc.customerId).padStart(4, '0')}`]
	];
	let fy = winY + mm(4);
	const fx = R - 190;
	for (const [k, v] of facts) {
		pdf.font('r').fontSize(8.5).fillColor(C.muted).text(k, fx, fy, { width: 85 });
		pdf.font('m').fontSize(8.5).fillColor(C.ink).text(v, fx + 85, fy, { width: 105, align: 'right' });
		fy += 14;
	}

	/* ---------- Titel und Einleitung */
	let y = Math.max(mm(100), fy + 20, pdf.y + 24);
	pdf.font('x').fontSize(19).fillColor(C.night).text(`${kind} ${doc.number ?? ''}`.trim(), L, y);
	y = pdf.y + 2;
	if (doc.title && doc.title !== kind) {
		pdf.font('m').fontSize(11).fillColor(C.muted).text(doc.title, L, y, { width: R - L });
		y = pdf.y;
	}
	if (cancels) {
		pdf.font('r').fontSize(9.5).fillColor(C.muted).text(`Storno zu Rechnung ${cancels}`, L, y + 2);
		y = pdf.y;
	}
	y += 14;
	pdf.font('r').fontSize(10).fillColor(C.ink).text('Guten Tag,', L, y);
	if (doc.intro) pdf.text(doc.intro, L, pdf.y + 6, { width: R - L, lineGap: 2 });
	y = pdf.y + 16;

	/* ---------- Positionen */
	const col = { pos: L, title: L + 26, qty: R - 244, unit: R - 194, price: R - 128, total: R - 66 };
	const header = (at: number) => {
		pdf.rect(L - 6, at - 5, R - L + 12, 20).fill(C.soft);
		pdf.font('b').fontSize(7.8).fillColor(C.muted);
		pdf.text('POS', col.pos, at, { width: 24, characterSpacing: 0.6 });
		pdf.text('LEISTUNG', col.title, at, { characterSpacing: 0.6 });
		pdf.text('MENGE', col.qty, at, { width: 46, align: 'right', characterSpacing: 0.6 });
		pdf.text('EINHEIT', col.unit + 6, at, { width: 60, characterSpacing: 0.6 });
		pdf.text('EINZELPREIS', col.price - 6, at, { width: 66, align: 'right', characterSpacing: 0.6 });
		pdf.text('GESAMT', col.total, at, { width: 66, align: 'right', characterSpacing: 0.6 });
		return at + 22;
	};
	y = header(y);
	const titleWidth = col.qty - col.title - 10;
	items.forEach((it, i) => {
		pdf.font('b').fontSize(9.5);
		const hTitle = pdf.heightOfString(it.title, { width: titleWidth });
		pdf.font('r').fontSize(8.5);
		const hDesc = it.description ? pdf.heightOfString(it.description, { width: titleWidth, lineGap: 1.2 }) + 3 : 0;
		const h = Math.max(hTitle + hDesc, 12) + 12;
		if (y + h > bottom - 10) {
			pdf.addPage();
			y = header(pdf.page.margins.top);
		}
		pdf.font('r').fontSize(9).fillColor(C.muted).text(String(i + 1), col.pos, y, { width: 24 });
		pdf.font('b').fontSize(9.5).fillColor(C.ink).text(it.title, col.title, y, { width: titleWidth });
		if (it.description) pdf.font('r').fontSize(8.5).fillColor(C.muted).text(it.description, col.title, y + hTitle + 3, { width: titleWidth, lineGap: 1.2 });
		pdf.font('r').fontSize(9.5).fillColor(C.ink);
		pdf.text(number(it.quantity), col.qty, y, { width: 46, align: 'right' });
		pdf.text(it.unit, col.unit + 6, y, { width: 60 });
		pdf.text(money(it.unitPriceCents), col.price - 6, y, { width: 66, align: 'right' });
		pdf.font('m').text(money(it.totalCents), col.total, y, { width: 66, align: 'right' });
		y += h;
		pdf.moveTo(L, y - 6).lineTo(R, y - 6).lineWidth(0.6).stroke(C.line);
	});

	/* ---------- Summen */
	const sums: [string, string, boolean][] = [];
	if (doc.taxMode === 'ust') {
		sums.push(['Summe netto', money(doc.netCents), false]);
		sums.push([`USt. ${doc.taxRate} %`, money(doc.taxCents), false]);
	}
	sums.push(['Gesamtbetrag', money(doc.grossCents), true]);
	if (y + sums.length * 18 + 40 > bottom) {
		pdf.addPage();
		y = pdf.page.margins.top;
	}
	y += 6;
	for (const [k, v, strong] of sums) {
		if (strong) {
			const gl = pdf.linearGradient(R - 220, 0, R, 0);
			gl.stop(0, C.teal).stop(0.52, C.nebula).stop(1, C.pink);
			pdf.rect(R - 220, y - 4, 220, 1.4).fill(gl);
			y += 4;
		}
		pdf.font(strong ? 'x' : 'r')
			.fontSize(strong ? 12 : 9.5)
			.fillColor(strong ? C.night : C.muted)
			.text(k, R - 220, y, { width: 120 });
		pdf.font(strong ? 'x' : 'm')
			.fontSize(strong ? 12 : 9.5)
			.fillColor(C.ink)
			.text(v, R - 110, y, { width: 110, align: 'right' });
		y += strong ? 22 : 16;
	}
	if (doc.taxMode === 'klein' && kleinText) {
		pdf.font('r').fontSize(8.5).fillColor(C.muted).text(kleinText, L, y, { width: R - L });
		y = pdf.y + 6;
	}

	/* ---------- Schluss und Zahlung */
	y += 8;
	if (doc.outro) {
		if (y + 50 > bottom) {
			pdf.addPage();
			y = pdf.page.margins.top;
		}
		pdf.font('r').fontSize(10).fillColor(C.ink).text(doc.outro, L, y, { width: R - L, lineGap: 2 });
		y = pdf.y + 12;
	}
	if (!isQuote && !cancels && doc.grossCents > 0 && (s.iban || s.bank)) {
		const lines = [
			`Bitte überweisen Sie ${money(doc.grossCents)}${doc.dueDate ? ` bis ${date(doc.dueDate)}` : ''} auf folgendes Konto:`,
			[s.bank, s.iban && `IBAN ${s.iban}`, s.bic && `BIC ${s.bic}`].filter(Boolean).join(' · '),
			`Verwendungszweck: ${doc.number ?? 'Rechnungsnummer'}`
		];
		pdf.font('r').fontSize(9);
		const h = pdf.heightOfString(lines.join('\n'), { width: R - L - 28, lineGap: 2 }) + 22;
		if (y + h > bottom) {
			pdf.addPage();
			y = pdf.page.margins.top;
		}
		pdf.roundedRect(L, y, R - L, h, 8).fill(C.soft);
		pdf.rect(L, y + 8, 2.5, h - 16).fill(C.teal);
		pdf.font('r').fontSize(9).fillColor(C.ink).text(lines.join('\n'), L + 16, y + 11, { width: R - L - 28, lineGap: 2 });
		y += h + 10;
	}
	pdf.font('r').fontSize(10).fillColor(C.ink).text('Freundliche Grüße', L, y + 4);
	pdf.font('b').text(s.owner || s.name, L, pdf.y + 2);

	/* ---------- Fußzeile und Wasserzeichen auf jeder Seite */
	const range = pdf.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		pdf.switchToPage(i);
		// Unterhalb des unteren Rands schreiben, ohne dass pdfkit eine neue Seite beginnt
		pdf.page.margins.bottom = 0;
		const fy0 = pdf.page.height - mm(22);
		pdf.moveTo(L, fy0 - 8).lineTo(R, fy0 - 8).lineWidth(0.6).stroke(C.line);
		const colW = (R - L) / 3;
		const footer = [
			[s.name, s.owner !== s.name ? s.owner : '', [s.street, [s.zip, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
			[s.email, s.phone, s.website],
			[s.iban ? `IBAN ${s.iban}` : '', s.vatId ? `UID ${s.vatId}` : s.taxNumber ? `St.-Nr. ${s.taxNumber}` : '', s.footerNote]
		];
		footer.forEach((lines, c) => {
			pdf.font('r')
				.fontSize(7.2)
				.fillColor(C.faint)
				.text(lines.filter(Boolean).join('\n'), L + c * colW, fy0, { width: colW - 8, align: c === 2 ? 'right' : c === 1 ? 'center' : 'left', lineGap: 1, height: mm(14), ellipsis: true });
		});
		if (range.count > 1) {
			pdf.font('r').fontSize(7.2).fillColor(C.faint).text(`Seite ${i + 1} von ${range.count}`, L, pdf.page.height - mm(9), { width: R - L, align: 'center', lineBreak: false });
		}
		if (draft) {
			pdf.save();
			pdf.rotate(-30, { origin: [W / 2, pdf.page.height / 2] });
			pdf.font('x').fontSize(96).fillColor(C.nebula).fillOpacity(0.08).text('ENTWURF', 0, pdf.page.height / 2 - 50, { width: W, align: 'center', lineBreak: false });
			pdf.restore();
		}
	}

	pdf.end();
	return done;
}
