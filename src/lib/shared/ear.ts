/**
 * Einnahmen-Ausgaben-Rechnung (Österreich, Zufluss-Abfluss-Prinzip):
 * Kategorien mit den Kennzahlen der Beilage E1a, Aufteilung brutto → netto/USt
 * und Abschreibung (AfA) für das Anlagenverzeichnis.
 *
 * Die Kennzahlen dienen der Orientierung beim Ausfüllen der E1a – vor dem
 * Einreichen mit der Steuerberatung abgleichen.
 */

export type EntryKind = 'einnahme' | 'ausgabe';

export interface Category {
	id: string;
	kind: EntryKind;
	label: string;
	/** Kennzahl der Beilage E1a */
	kz: string;
	hint?: string;
}

export const CATEGORIES: Category[] = [
	{ id: 'erloese', kind: 'einnahme', label: 'Erlöse aus Leistungen', kz: '9040', hint: 'Bezahlte Rechnungen aus dem Portal zählen automatisch' },
	{ id: 'ertraege', kind: 'einnahme', label: 'Übrige Erträge', kz: '9090', hint: 'z. B. Zinsen, Förderungen, Verkauf von Anlagen' },
	{ id: 'software', kind: 'ausgabe', label: 'Software, Abos & Lizenzen', kz: '9230' },
	{ id: 'hosting', kind: 'ausgabe', label: 'Hosting, Server & Domains', kz: '9230' },
	{ id: 'buero', kind: 'ausgabe', label: 'Büro & Arbeitsmittel', kz: '9230', hint: 'Kleinmaterial, Zubehör' },
	{ id: 'gwg', kind: 'ausgabe', label: 'Geringwertige Wirtschaftsgüter', kz: '9130', hint: 'Anschaffungen bis 1.000 € (netto) – sofort absetzbar; teurere ins Anlagenverzeichnis' },
	{ id: 'telefon', kind: 'ausgabe', label: 'Telefon & Internet', kz: '9230' },
	{ id: 'fremdleistungen', kind: 'ausgabe', label: 'Fremdleistungen', kz: '9110', hint: 'Freelancer, Subunternehmer, Agenturen' },
	{ id: 'waren', kind: 'ausgabe', label: 'Waren & Material', kz: '9100' },
	{ id: 'werbung', kind: 'ausgabe', label: 'Werbung & Repräsentation', kz: '9190' },
	{ id: 'reise', kind: 'ausgabe', label: 'Reise- & Fahrtkosten, Kilometergeld', kz: '9150' },
	{ id: 'kfz', kind: 'ausgabe', label: 'Kfz-Kosten', kz: '9160', hint: 'tatsächliche Kosten, ohne AfA und Leasing' },
	{ id: 'miete', kind: 'ausgabe', label: 'Miete, Pacht & Leasing', kz: '9170' },
	{ id: 'fortbildung', kind: 'ausgabe', label: 'Fortbildung & Fachliteratur', kz: '9230' },
	{ id: 'beratung', kind: 'ausgabe', label: 'Steuer- & Rechtsberatung', kz: '9230' },
	{ id: 'versicherung', kind: 'ausgabe', label: 'Betriebliche Versicherungen', kz: '9230' },
	{ id: 'sv', kind: 'ausgabe', label: 'Sozialversicherung (SVS)', kz: '9220' },
	{ id: 'personal', kind: 'ausgabe', label: 'Personal', kz: '9120' },
	{ id: 'zinsen', kind: 'ausgabe', label: 'Zinsen', kz: '9210' },
	{ id: 'gebuehren', kind: 'ausgabe', label: 'Gebühren & Bankspesen', kz: '9230' },
	{ id: 'sonstiges', kind: 'ausgabe', label: 'Sonstige Ausgaben', kz: '9230' }
];

/** Nur aus dem Anlagenverzeichnis berechnet, nicht von Hand zu buchen */
export const AFA: Category = { id: 'afa', kind: 'ausgabe', label: 'Abschreibung (AfA)', kz: '9130' };
export const ABGANG: Category = { id: 'abgang', kind: 'ausgabe', label: 'Restbuchwert ausgeschiedener Anlagen', kz: '9200' };

const ALL = [...CATEGORIES, AFA, ABGANG];
export const categoryOf = (id: string): Category => ALL.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const KZ_LABELS: Record<string, string> = {
	'9040': 'Erlöse / Erträge',
	'9090': 'Übrige Erträge / Betriebseinnahmen',
	'9100': 'Waren, Rohstoffe, Hilfsstoffe',
	'9110': 'Fremdpersonal und Fremdleistungen',
	'9120': 'Personalaufwand',
	'9130': 'Abschreibungen (AfA, geringwertige Wirtschaftsgüter)',
	'9150': 'Reise- und Fahrtspesen, Kilometergeld',
	'9160': 'Tatsächliche Kfz-Kosten',
	'9170': 'Miet- und Pachtaufwand, Leasing',
	'9190': 'Werbe- und Repräsentationsaufwand',
	'9200': 'Buchwert abgehender Anlagen',
	'9210': 'Zinsen und ähnliche Aufwendungen',
	'9220': 'Eigene Pflichtversicherungsbeiträge (SVS)',
	'9230': 'Übrige Betriebsausgaben'
};

export const TAX_RATES = [20, 13, 10, 0];
export const PAYMENT_METHODS = [
	{ id: 'bank', label: 'Überweisung' },
	{ id: 'karte', label: 'Karte' },
	{ id: 'bar', label: 'Bar' },
	{ id: 'paypal', label: 'PayPal' },
	{ id: 'lastschrift', label: 'Lastschrift' }
] as const;

/** Amtliches Kilometergeld je km (Pkw, seit 2025) */
export const KM_RATE_CENTS = 50;

/**
 * Brutto in Netto und Umsatzsteuer teilen. Ohne Vorsteuerabzug bzw. als
 * Kleinunternehmer zählt der volle Bruttobetrag.
 */
export function split(grossCents: number, rate: number, vat: boolean): { net: number; tax: number } {
	if (!vat || !rate) return { net: grossCents, tax: 0 };
	const net = Math.round((grossCents * 100) / (100 + rate));
	return { net, tax: grossCents - net };
}

export interface AssetLike {
	costCents: number;
	/** Datum der Inbetriebnahme (YYYY-MM-DD) */
	startDate: string;
	years: number;
	disposedOn?: string | null;
}

export interface AfaYear {
	year: number;
	/** AfA dieses Jahres */
	cents: number;
	/** Restbuchwert am Jahresende */
	remaining: number;
	/** Restbuchwert, der beim Ausscheiden als Aufwand anfällt */
	disposal: number;
}

const firstHalf = (day: string) => Number(day.slice(5, 7)) <= 6;

/**
 * Lineare AfA mit Halbjahresregel: Inbetriebnahme im zweiten Halbjahr → im
 * ersten Jahr nur die halbe Jahres-AfA, der Rest am Ende. Scheidet die Anlage
 * aus, gibt es im Jahr des Ausscheidens die halbe (1. Halbjahr) bzw. volle
 * (2. Halbjahr) AfA, der Restbuchwert wird dann als Aufwand abgesetzt.
 */
export function afaSchedule(a: AssetLike): AfaYear[] {
	const years = Math.max(1, Math.round(a.years));
	const annual = a.costCents / years;
	const startYear = Number(a.startDate.slice(0, 4));
	const endYear = a.disposedOn ? Number(a.disposedOn.slice(0, 4)) : Infinity;
	const out: AfaYear[] = [];
	let remaining = a.costCents;
	for (let y = startYear; remaining > 0 && y <= Math.min(endYear, startYear + years + 1); y++) {
		let share = annual;
		if (y === startYear && !firstHalf(a.startDate)) share = annual / 2;
		if (y === endYear && a.disposedOn && firstHalf(a.disposedOn) && y !== startYear) share = annual / 2;
		let cents = Math.min(remaining, Math.round(share));
		// Rundungsreste im letzten regulären Jahr mitnehmen
		if (remaining - cents < years) cents = remaining;
		remaining -= cents;
		let disposal = 0;
		if (y === endYear) {
			disposal = remaining;
			remaining = 0;
		}
		out.push({ year: y, cents, remaining, disposal });
	}
	return out;
}
