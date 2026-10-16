import { asc, desc, eq } from 'drizzle-orm';
import { afaSchedule, CATEGORIES, PAYMENT_METHODS, TAX_RATES, type EntryKind } from '$lib/shared/ear';
import { today } from '$lib/shared/format';
import { INTERVALS } from '$lib/shared/stages';
import { db } from '$lib/server/db';
import { assets, ledgerEntries, ledgerRecurring } from '$lib/server/db/schema';
import { bookRecurring, removeReceipt, saveReceipt, summarize, vatRegistered, yearRows, years } from '$lib/server/ear';
import { act, bad, type Fields } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

const TABS = ['uebersicht', 'buchungen', 'wiederkehrend', 'anlagen'] as const;

export const load: PageServerLoad = async ({ url }) => {
	const year = /^\d{4}$/.test(url.searchParams.get('jahr') ?? '') ? url.searchParams.get('jahr')! : today().slice(0, 4);
	const tab = TABS.find((t) => t === url.searchParams.get('tab')) ?? 'uebersicht';
	const [rows, recurring, assetRows, yearList, vat] = await Promise.all([
		yearRows(year),
		db.select().from(ledgerRecurring).orderBy(desc(ledgerRecurring.active), asc(ledgerRecurring.nextDate)),
		db.select().from(assets).orderBy(desc(assets.startDate)),
		years(),
		vatRegistered()
	]);
	return {
		year,
		tab,
		years: yearList,
		vat,
		rows,
		summary: summarize(rows),
		recurring,
		assets: assetRows.map((a) => {
			const plan = afaSchedule(a);
			const now = plan.find((p) => p.year === Number(year));
			const before = plan.filter((p) => p.year < Number(year));
			return {
				...a,
				plan,
				afaYear: now?.cents ?? 0,
				bookValue: now ? now.remaining : (before.at(-1)?.remaining ?? (Number(year) < Number(a.startDate.slice(0, 4)) ? a.costCents : 0))
			};
		})
	};
};

/* ------------------------------------------------------------------ Eingaben prüfen */

function entryValues(f: Fields, kind: EntryKind) {
	const category = f.req('category', 'eine Kategorie', 40);
	if (!CATEGORIES.some((c) => c.id === category && c.kind === kind)) bad('Diese Kategorie passt nicht.');
	const grossCents = f.money('amount') ?? bad('Bitte einen Betrag angeben.');
	if (grossCents <= 0) bad('Der Betrag muss größer als 0 sein.');
	const taxRate = f.int('taxRate') ?? 0;
	if (!TAX_RATES.includes(taxRate)) bad('Unbekannter Steuersatz.');
	const payment = f.str('paymentMethod', 20);
	return {
		date: f.day('date') ?? bad('Bitte das Datum der Zahlung angeben.'),
		description: f.req('description', 'eine Beschreibung', 300),
		party: f.str('party', 200),
		category,
		grossCents,
		taxRate,
		paymentMethod: PAYMENT_METHODS.some((p) => p.id === payment) ? payment : null,
		notes: f.str('notes', 2000)
	};
}

export const actions: Actions = {
	/** Einnahme oder Ausgabe anlegen bzw. ändern, optional mit Beleg */
	buchung: act(async (_e, f) => {
		const id = f.id('id');
		const kind = f.oneOf('kind', ['einnahme', 'ausgabe'] as const, 'ausgabe');
		const values = entryValues(f, kind);
		const file = f.file('receipt');
		const [old] = id ? await db.select().from(ledgerEntries).where(eq(ledgerEntries.id, id)) : [];
		if (id && !old) bad('Diese Buchung gibt es nicht mehr.');
		let receipt = {};
		if (file) {
			receipt = await saveReceipt(file);
			await removeReceipt(old?.receiptFile);
		} else if (old?.receiptFile && f.bool('removeReceipt')) {
			await removeReceipt(old.receiptFile);
			receipt = { receiptFile: null, receiptName: null, receiptMime: null, receiptSize: null };
		}
		if (old) {
			await db
				.update(ledgerEntries)
				.set({ ...values, ...receipt, updatedAt: new Date().toISOString() })
				.where(eq(ledgerEntries.id, old.id));
			return { message: 'Gespeichert' };
		}
		await db.insert(ledgerEntries).values({ kind, ...values, ...receipt, vat: await vatRegistered() });
		return { message: kind === 'einnahme' ? 'Einnahme gebucht' : 'Ausgabe gebucht' };
	}),

	buchung_loeschen: act(async (_e, f) => {
		const [old] = await db.select().from(ledgerEntries).where(eq(ledgerEntries.id, f.id('id') ?? 0));
		if (!old) bad('Diese Buchung gibt es nicht mehr.');
		await db.delete(ledgerEntries).where(eq(ledgerEntries.id, old.id));
		await removeReceipt(old.receiptFile);
		return { message: 'Buchung gelöscht' };
	}),

	/** Wiederkehrende Ausgabe anlegen bzw. ändern */
	wiederkehrend: act(async (_e, f) => {
		const id = f.id('id');
		const v = entryValues(f, 'ausgabe');
		const values = {
			description: v.description,
			party: v.party,
			category: v.category,
			grossCents: v.grossCents,
			taxRate: v.taxRate,
			paymentMethod: v.paymentMethod,
			interval: f.oneOf('interval', INTERVALS.map((i) => i.id), 'monat'),
			nextDate: v.date,
			endDate: f.day('endDate')
		};
		if (values.endDate && values.endDate < values.nextDate) bad('Das Ende liegt vor der nächsten Buchung.');
		if (id) await db.update(ledgerRecurring).set(values).where(eq(ledgerRecurring.id, id));
		else await db.insert(ledgerRecurring).values(values);
		const booked = await bookRecurring();
		return { message: booked ? `Gespeichert – ${booked} fällige Buchung${booked === 1 ? '' : 'en'} angelegt` : 'Gespeichert' };
	}),

	wiederkehrend_aktiv: act(async (_e, f) => {
		const [r] = await db.select().from(ledgerRecurring).where(eq(ledgerRecurring.id, f.id('id') ?? 0));
		if (!r) bad('Gibt es nicht mehr.');
		await db.update(ledgerRecurring).set({ active: !r.active }).where(eq(ledgerRecurring.id, r.id));
		return { message: r.active ? 'Pausiert' : 'Wieder aktiv' };
	}),

	wiederkehrend_loeschen: act(async (_e, f) => {
		await db.delete(ledgerRecurring).where(eq(ledgerRecurring.id, f.id('id') ?? 0));
		return { message: 'Gelöscht – bereits gebuchte Ausgaben bleiben' };
	}),

	jetzt_buchen: act(async () => {
		const booked = await bookRecurring();
		return { message: booked ? `${booked} Buchung${booked === 1 ? '' : 'en'} angelegt` : 'Nichts fällig' };
	}),

	/** Anlage (über 1.000 €) anlegen bzw. ändern */
	anlage: act(async (_e, f) => {
		const id = f.id('id');
		const costCents = f.money('cost') ?? bad('Bitte die Anschaffungskosten angeben.');
		if (costCents <= 0) bad('Die Anschaffungskosten müssen größer als 0 sein.');
		const years = f.int('years') ?? bad('Bitte die Nutzungsdauer angeben.');
		if (years < 1 || years > 50) bad('Die Nutzungsdauer muss zwischen 1 und 50 Jahren liegen.');
		const values = {
			name: f.req('name', 'eine Bezeichnung', 200),
			startDate: f.day('startDate') ?? bad('Bitte das Datum der Inbetriebnahme angeben.'),
			costCents,
			years,
			disposedOn: f.day('disposedOn'),
			notes: f.str('notes', 2000)
		};
		if (values.disposedOn && values.disposedOn < values.startDate) bad('Das Ausscheiden liegt vor der Inbetriebnahme.');
		const file = f.file('receipt');
		const [old] = id ? await db.select().from(assets).where(eq(assets.id, id)) : [];
		let receipt = {};
		if (file) {
			receipt = await saveReceipt(file);
			await removeReceipt(old?.receiptFile);
		} else if (old?.receiptFile && f.bool('removeReceipt')) {
			await removeReceipt(old.receiptFile);
			receipt = { receiptFile: null, receiptName: null, receiptMime: null, receiptSize: null };
		}
		if (old) await db.update(assets).set({ ...values, ...receipt }).where(eq(assets.id, old.id));
		else await db.insert(assets).values({ ...values, ...receipt });
		return { message: 'Anlage gespeichert' };
	}),

	anlage_loeschen: act(async (_e, f) => {
		const [old] = await db.select().from(assets).where(eq(assets.id, f.id('id') ?? 0));
		if (!old) bad('Diese Anlage gibt es nicht mehr.');
		await db.delete(assets).where(eq(assets.id, old.id));
		await removeReceipt(old.receiptFile);
		return { message: 'Anlage gelöscht' };
	})
};
