/**
 * Einstellungen, die das Portal in der Tabelle „settings“ pflegt und die
 * Webseite liest. Kopie aus dem Repo Astronox-Development (src/lib/settings.ts) –
 * Änderungen dort hier nachziehen.
 */

export interface TermineSettings {
	/** Buchbare Zeiten je Wochentag (0 = Sonntag), Uhrzeit als „HH:MM“ */
	hours: { weekday: number; from: string; to: string }[];
	duration: number;
	buffer: number;
	leadHours: number;
	days: number;
	/** Gesperrte Zeiträume (Urlaub usw.), Datum als „YYYY-MM-DD“ */
	blocked: { from: string; to: string; note?: string }[];
	holidays: boolean;
	videoLink: string;
	calendarKey: string;
}

export interface Choice {
	id: string;
	label: string;
	hint?: string;
}

export interface AnfrageSettings {
	projectTypes: Choice[];
	budgets: Choice[];
	timeframes: Choice[];
}

/** Anmeldung beim Mailserver: Benutzer + Passwort oder Microsoft 365 (OAuth) */
export type MailAuth = 'passwort' | 'microsoft';

export interface SmtpSettings {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	/** verschlüsselt („v1:…“) */
	password: string;
	from: string;
	fromName: string;
	/** Empfänger für Anfragen und Buchungen */
	inbox: string;
	/** fehlt bei älteren Einträgen = passwort */
	auth?: MailAuth;
}

/** App-Registrierung in Microsoft Entra – für die Anmeldung bei Microsoft 365 */
export interface MicrosoftSettings {
	/** Verzeichnis-ID (Mandant) */
	tenantId: string;
	/** Anwendungs-ID (Client) */
	clientId: string;
	/** verschlüsselt („v1:…“) */
	clientSecret: string;
	/** Objekt-ID der Unternehmensanwendung – nur für die Befehle in der Anleitung */
	objectId: string;
	/** Ablauf des geheimen Schlüssels (YYYY-MM-DD) – das Portal erinnert rechtzeitig */
	secretExpires: string;
}

/* ------------------------------------------------------------------ nur Portal */

/** Briefkopf für Angebote und Rechnungen */
export interface FirmaSettings {
	name: string;
	owner: string;
	street: string;
	zip: string;
	city: string;
	country: string;
	email: string;
	phone: string;
	website: string;
	/** UID-Nummer (ATU…) – als Kleinunternehmer meist leer */
	vatId: string;
	taxNumber: string;
	bank: string;
	iban: string;
	bic: string;
	/** zusätzliche Zeile in der Fußzeile, z. B. Gewerbebehörde */
	footerNote: string;
}

export interface RechnungSettings {
	taxMode: 'klein' | 'ust';
	taxRate: number;
	/** Hinweis bei Kleinunternehmerregelung */
	kleinText: string;
	/** Nummernformat: {JJJJ}/{JJ} = Jahr, {NR} = laufende Nummer des Jahres (siehe numbers.ts) */
	invoicePrefix: string;
	quotePrefix: string;
	digits: number;
	paymentDays: number;
	quoteValidDays: number;
	hourlyRateCents: number;
	quoteIntro: string;
	quoteOutro: string;
	invoiceIntro: string;
	invoiceOutro: string;
}

export interface ImapSettings {
	enabled: boolean;
	host: string;
	port: number;
	secure: boolean;
	user: string;
	/** verschlüsselt („v1:…“) */
	password: string;
	mailbox: string;
	/** Gesendete Mails aus dem Portal dort ablegen (leer = nicht ablegen) */
	sentMailbox: string;
	/** fehlt bei älteren Einträgen = passwort */
	auth?: MailAuth;
}

export interface MonitorSettings {
	/** Warnung so viele Tage vor Ablauf von Zertifikat oder Domain */
	warnDays: number;
}
