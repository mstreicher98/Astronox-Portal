/**
 * Einnahmen-Ausgaben-Rechnung (Österreich, Zufluss-Abfluss-Prinzip):
 * Kategorien mit den Kennzahlen der Beilage E1a, Aufteilung brutto → netto/USt
 * und Abschreibung (AfA) für das Anlagenverzeichnis.
 *
 * Kennzahlen laut Beilage E 1a 2025 (BMF, Version vom 24.10.2025). Sie ändern sich
 * gelegentlich – jedes Jahr mit dem aktuellen Formular abgleichen.
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
	{ id: 'werbung', kind: 'ausgabe', label: 'Werbung & Repräsentation', kz: '9200' },
	{ id: 'reise', kind: 'ausgabe', label: 'Reise- & Fahrtkosten, Kilometergeld', kz: '9160' },
	{ id: 'kfz', kind: 'ausgabe', label: 'Kfz-Kosten', kz: '9170', hint: 'tatsächliche Kosten, ohne AfA, Leasing und Kilometergeld' },
	{ id: 'miete', kind: 'ausgabe', label: 'Miete, Pacht & Leasing', kz: '9180' },
	{ id: 'fortbildung', kind: 'ausgabe', label: 'Fortbildung & Fachliteratur', kz: '9230' },
	{ id: 'beratung', kind: 'ausgabe', label: 'Steuer- & Rechtsberatung', kz: '9230' },
	{ id: 'versicherung', kind: 'ausgabe', label: 'Betriebliche Versicherungen', kz: '9230' },
	{ id: 'sv', kind: 'ausgabe', label: 'Sozialversicherung (SVS)', kz: '9225' },
	{ id: 'arbeitsplatz_gross', kind: 'ausgabe', label: 'Großes Arbeitsplatzpauschale', kz: '9217', hint: '1.200 € für ein volles Jahr, wenn du sonst keinen Arbeitsplatz hast – Voraussetzungen mit der Steuerberatung klären' },
	{ id: 'arbeitsplatz_klein', kind: 'ausgabe', label: 'Kleines Arbeitsplatzpauschale', kz: '9215', hint: '300 € für ein volles Jahr' },
	{ id: 'mobiliar', kind: 'ausgabe', label: 'Ergonomisches Mobiliar', kz: '9216', hint: 'Schreibtisch, Drehstuhl, Lampe – höchstens 300 € pro Jahr' },
	{ id: 'personal', kind: 'ausgabe', label: 'Personal', kz: '9120' },
	{ id: 'zinsen', kind: 'ausgabe', label: 'Zinsen', kz: '9220' },
	{ id: 'gebuehren', kind: 'ausgabe', label: 'Gebühren & Bankspesen', kz: '9230' },
	{ id: 'sonstiges', kind: 'ausgabe', label: 'Sonstige Ausgaben', kz: '9230' }
];

/** Nur aus dem Anlagenverzeichnis berechnet, nicht von Hand zu buchen */
export const AFA: Category = { id: 'afa', kind: 'ausgabe', label: 'Abschreibung (AfA)', kz: '9130' };
export const ABGANG: Category = { id: 'abgang', kind: 'ausgabe', label: 'Restbuchwert ausgeschiedener Anlagen', kz: '9210' };

const ALL = [...CATEGORIES, AFA, ABGANG];
export const categoryOf = (id: string): Category => ALL.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** Bezeichnungen laut Beilage E 1a 2025 (gekürzt) */
export const KZ_LABELS: Record<string, string> = {
	'9040': 'Erträge/Betriebseinnahmen (Waren-/Leistungserlöse)',
	'9050': 'Erträge laut Mitteilung gemäß § 109a',
	'9060': 'Anlagenerträge/Entnahmewerte von Anlagevermögen',
	'9090': 'Übrige Erträge/Betriebseinnahmen (Saldo)',
	'9100': 'Waren, Rohstoffe, Hilfsstoffe',
	'9110': 'Beigestelltes Personal (Fremdpersonal) und Fremdleistungen',
	'9120': 'Personalaufwand (eigenes Personal)',
	'9130': 'Abschreibungen auf das Anlagevermögen (AfA, geringwertige Wirtschaftsgüter)',
	'9160': 'Reise- und Fahrtspesen inkl. Kilometergeld und Diäten',
	'9170': 'Tatsächliche Kfz-Kosten (ohne AfA, Leasing und Kilometergeld)',
	'9180': 'Miet- und Pachtaufwand, Leasing',
	'9190': 'Provisionen an Dritte, Lizenzgebühren',
	'9200': 'Werbe- und Repräsentationsaufwendungen, Spenden, Trinkgelder',
	'9210': 'Buchwert abgegangener Anlagen',
	'9215': 'Kleines Arbeitsplatzpauschale',
	'9216': 'Ergonomisch geeignetes Mobiliar',
	'9217': 'Großes Arbeitsplatzpauschale',
	'9220': 'Zinsen und ähnliche Aufwendungen',
	'9225': 'Pflichtversicherungsbeiträge (SVS), Selbständigenvorsorge',
	'9230': 'Übrige Aufwendungen/Betriebsausgaben (Saldo)'
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
