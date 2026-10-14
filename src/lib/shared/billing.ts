import { addDays, addMonths, daysBetween } from './format';

/**
 * Abrechnung von Verträgen – ohne Datenbank, damit sie sich testen lässt.
 *
 * Regeln:
 *  - abgerechnet wird im Voraus, jeweils ab dem Monatsersten
 *  - beginnt ein Vertrag mitten im Monat, wird der Rest dieses Monats anteilig
 *    berechnet; danach laufen die Zeiträume ab dem nächsten Ersten
 *  - endet ein Vertrag mitten in einem Zeitraum, wird dieser anteilig berechnet
 */

export interface BillingPeriod {
	from: string;
	to: string;
	/** Anteil am Preis eines vollen Zeitraums (1 = voll) */
	factor: number;
	/** berechnete Tage und die Tage, auf die sich der Anteil bezieht */
	days: number;
	ofDays: number;
	/** erster Monat ab Vertragsbeginn mitten im Monat */
	partialMonth: boolean;
	/** hier beginnt der nächste Zeitraum */
	next: string;
}

export const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
export const endOfMonth = (day: string) => addDays(addMonths(firstOfMonth(day), 1), -1);

/** Zeitraum, der an `start` beginnt – oder null, wenn der Vertrag dann schon beendet ist */
export function periodFrom(start: string, months: number, endDate: string | null): BillingPeriod | null {
	if (endDate && start > endDate) return null;
	if (start.slice(8) !== '01') {
		const monthStart = firstOfMonth(start);
		const monthEnd = endOfMonth(start);
		const to = endDate && endDate < monthEnd ? endDate : monthEnd;
		const days = daysBetween(start, to) + 1;
		const ofDays = daysBetween(monthStart, monthEnd) + 1;
		return { from: start, to, factor: days / ofDays / months, days, ofDays, partialMonth: true, next: addMonths(monthStart, 1) };
	}
	const nominalEnd = addDays(addMonths(start, months), -1);
	const to = endDate && endDate < nominalEnd ? endDate : nominalEnd;
	const days = daysBetween(start, to) + 1;
	const ofDays = daysBetween(start, nominalEnd) + 1;
	return { from: start, to, factor: days / ofDays, days, ofDays, partialMonth: false, next: addMonths(start, months) };
}

/** Alle Zeiträume, die bis einschließlich `until` begonnen haben und noch nicht abgerechnet sind */
export function duePeriods(nextInvoiceDate: string, months: number, endDate: string | null, until: string, max = 12): BillingPeriod[] {
	const out: BillingPeriod[] = [];
	let start = nextInvoiceDate;
	while (start <= until && out.length < max) {
		const p = periodFrom(start, months, endDate);
		if (!p) break;
		out.push(p);
		start = p.next;
	}
	return out;
}

/** Preis einer Position für diesen Zeitraum, auf Cent gerundet */
export const proratedCents = (unitPriceCents: number, p: Pick<BillingPeriod, 'factor'>) => Math.round(unitPriceCents * p.factor);

/** Hinweis für die Rechnung, wenn nicht der volle Preis berechnet wird */
export function prorationNote(p: BillingPeriod, months: number): string | null {
	if (p.factor === 1) return null;
	const base = `anteilig für ${p.days} von ${p.ofDays} Tagen`;
	return p.partialMonth && months > 1 ? `${base} (Monatsanteil des Zeitraumpreises)` : base;
}

/**
 * Frühestes Vertragsende bei einer Kündigung am `cancelledOn`:
 * Kündigungsfrist jeweils zum Monatsende, frühestens nach der Mindestlaufzeit.
 */
export function earliestEnd(startDate: string, cancelledOn: string, noticeMonths: number | null, minTermMonths: number | null): string {
	const byNotice = endOfMonth(addMonths(cancelledOn, noticeMonths ?? 0));
	if (!minTermMonths) return byNotice;
	const byTerm = endOfMonth(addDays(addMonths(startDate, minTermMonths), -1));
	return byTerm > byNotice ? byTerm : byNotice;
}


/** Wert pro Monat – für Übersichten über Verträge mit verschiedenen Intervallen */
export const monthlyCents = (amountCents: number, months: number) => amountCents / months;

export type ContractStatus = 'aktiv' | 'gekuendigt' | 'beendet' | 'pausiert' | 'geplant';

/** Status eines Vertrags an einem Tag */
export function contractStatus(c: { active: boolean; startDate: string; endDate: string | null; cancelledOn: string | null }, day: string): ContractStatus {
	if (c.endDate && c.endDate < day) return 'beendet';
	if (!c.active) return c.endDate ? 'beendet' : 'pausiert';
	if (c.startDate > day) return 'geplant';
	if (c.cancelledOn || c.endDate) return 'gekuendigt';
	return 'aktiv';
}

export const STATUS_LABEL: Record<ContractStatus, { label: string; tone: 'ok' | 'warn' | 'muted' | 'info' }> = {
	aktiv: { label: 'Aktiv', tone: 'ok' },
	gekuendigt: { label: 'Gekündigt', tone: 'warn' },
	beendet: { label: 'Beendet', tone: 'muted' },
	pausiert: { label: 'Pausiert', tone: 'muted' },
	geplant: { label: 'Beginnt bald', tone: 'info' }
};
