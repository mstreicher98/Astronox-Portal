/**
 * Aufbau der Webseiten-Inhalte – Kopie der Typen aus dem Repo Astronox-Development
 * (src/lib/content.ts). Bei Änderungen dort hier nachziehen.
 */

export type ServiceId = 'webseiten' | 'webapps' | 'tools' | 'hosting' | 'redesign';

/** Jede Leistung hat ihre eigene Farbe – gleich im Orbit und in der Liste */
export const SERVICE_COLORS: Record<ServiceId, string> = {
	webseiten: 'var(--accent)',
	webapps: 'var(--sky)',
	tools: 'var(--violet)',
	hosting: 'var(--pink)',
	redesign: 'var(--peach)'
};

export const nav = [
	{ href: '#leistungen', label: 'Leistungen' },
	{ href: '#ablauf', label: 'Ablauf' },
	{ href: '#referenzen', label: 'Referenzen' },
	{ href: '#pakete', label: 'Pakete' },
	{ href: '#ueber-mich', label: 'Über mich' },
	{ href: '#kontakt', label: 'Kontakt' }
];

export interface Service {
	id: ServiceId;
	name: string;
	/** kurzer Name für die Beschriftung im Orbit */
	short: string;
	text: string;
	examples: string[];
}

export interface Reference {
	title: string;
	kind: string;
	text: string;
	url: string;
	/** Bild aus dem Portal, z. B. „/medien/monsipan.webp“ (16:10) */
	image: string;
	/** Platzhalter werden gestrichelt und gedämpft dargestellt */
	placeholder: boolean;
}

export interface Package {
	name: string;
	price: string;
	for: string;
	features: string[];
	highlight: boolean;
	/** Wohin der Knopf führt */
	cta: 'termin' | 'anfrage';
}

export interface SiteContent {
	allgemein: { name: string; owner: string; email: string; title: string; description: string; inFounding: boolean };
	start: { title: string; lead: string };
	leistungen: { title: string; text: string; items: Service[] };
	arbeitsweise: { title: string; text: string; items: { title: string; text: string }[] };
	ablauf: { title: string; text: string; items: { mark: string; title: string; text: string }[] };
	referenzen: { title: string; text: string; items: Reference[] };
	pakete: { title: string; text: string; items: Package[]; hosting: { title: string; price: string; text: string }; note: string };
	ueberMich: { title: string; paragraphs: string[]; photo: string };
	kontakt: { title: string; lead: string };
	impressum: { markdown: string };
	datenschutz: { markdown: string };
}

export type ContentKey = keyof SiteContent;

export const CONTENT_KEYS: ContentKey[] = ['allgemein', 'start', 'leistungen', 'arbeitsweise', 'ablauf', 'referenzen', 'pakete', 'ueberMich', 'kontakt', 'impressum', 'datenschutz'];

/** Abschnitte, wie sie im Portal unter „Webseite“ erscheinen */
export const SECTIONS: { key: ContentKey; label: string; hint: string; anchor: string }[] = [
	{ key: 'allgemein', label: 'Allgemein', hint: 'Name, Titel für Suchmaschinen, Status „in Gründung“', anchor: '' },
	{ key: 'start', label: 'Startbereich', hint: 'Große Überschrift und Einleitung', anchor: '#top' },
	{ key: 'leistungen', label: 'Leistungen', hint: 'Die fünf Leistungen mit Beispielen', anchor: '#leistungen' },
	{ key: 'arbeitsweise', label: 'Arbeitsweise', hint: 'Grundsätze neben dem Terminal', anchor: '#arbeitsweise' },
	{ key: 'ablauf', label: 'Ablauf', hint: 'Countdown zum Launch', anchor: '#ablauf' },
	{ key: 'referenzen', label: 'Referenzen', hint: 'Projekte mit Bild', anchor: '#referenzen' },
	{ key: 'pakete', label: 'Pakete & Preise', hint: 'Pakete, Hosting, Hinweis zu den Preisen', anchor: '#pakete' },
	{ key: 'ueberMich', label: 'Über mich', hint: 'Text und Foto', anchor: '#ueber-mich' },
	{ key: 'kontakt', label: 'Kontakt', hint: 'Überschrift über Terminbuchung und Anfrage', anchor: '#kontakt' },
	{ key: 'impressum', label: 'Impressum', hint: 'Rechtstext', anchor: '/impressum' },
	{ key: 'datenschutz', label: 'Datenschutz', hint: 'Rechtstext', anchor: '/datenschutz' }
];
