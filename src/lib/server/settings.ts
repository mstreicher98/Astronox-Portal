import { eq } from 'drizzle-orm';
import { MAIL_DEFAULTS, type MailSettings } from '$lib/shared/mails';
import type { AnfrageSettings, FirmaSettings, ImapSettings, MonitorSettings, RechnungSettings, SmtpSettings, TermineSettings } from '$lib/shared/settings';
import { db } from './db';
import { settings } from './db/site';

/**
 * Einstellungen in der gemeinsamen Tabelle „settings“ (JSON je Schlüssel).
 * termine, anfrage und smtp liest auch die Webseite – sie übernimmt Änderungen
 * innerhalb weniger Sekunden.
 */

export interface SettingsMap {
	termine: TermineSettings;
	anfrage: AnfrageSettings;
	smtp: SmtpSettings;
	firma: FirmaSettings;
	rechnung: RechnungSettings;
	imap: ImapSettings;
	/** Texte und Fußzeile der Mails – immer über mailSettings() lesen, damit Neues ergänzt wird */
	mails: MailSettings;
	monitor: MonitorSettings;
	push: { publicKey: string; privateKey: string };
	sync: { inquiryId: number; bookingId: number; cancelledAt: string; quoteResponseId: number };
	imapStand: { mailbox: string; uidValidity: string; lastUid: number; lastSync: string; lastError: string };
	/** Letzter Lauf der täglichen Aufgaben (Sicherung, Abo-Rechnungen, Fristen) */
	taeglich: { day: string };
}

export const DEFAULTS: { [K in keyof SettingsMap]: SettingsMap[K] } = {
	termine: { hours: [], duration: 30, buffer: 0, leadHours: 24, days: 28, blocked: [], holidays: true, videoLink: '', calendarKey: '' },
	anfrage: { projectTypes: [], budgets: [], timeframes: [] },
	smtp: { host: '', port: 587, secure: false, user: '', password: '', from: 'office@astronox.dev', fromName: 'Astronox Development', inbox: 'office@astronox.dev' },
	firma: {
		name: 'Astronox Development',
		owner: 'Matthias Streicher',
		street: '',
		zip: '',
		city: '',
		country: 'Österreich',
		email: 'office@astronox.dev',
		phone: '',
		website: 'astronox.dev',
		vatId: '',
		taxNumber: '',
		bank: '',
		iban: '',
		bic: '',
		footerNote: ''
	},
	rechnung: {
		taxMode: 'klein',
		taxRate: 20,
		kleinText: 'Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG.',
		invoicePrefix: 'RE{JJ} {NR}',
		quotePrefix: 'AN{JJ} {NR}',
		digits: 4,
		paymentDays: 14,
		quoteValidDays: 30,
		hourlyRateCents: 8000,
		quoteIntro: 'vielen Dank für Ihr Interesse. Gerne biete ich Ihnen folgende Leistungen an:',
		quoteOutro: 'Ich freue mich auf die Zusammenarbeit. Bei Fragen erreichen Sie mich jederzeit.',
		invoiceIntro: 'vielen Dank für Ihren Auftrag. Ich erlaube mir, folgende Leistungen in Rechnung zu stellen:',
		invoiceOutro: 'Bitte überweisen Sie den Betrag bis zum angegebenen Fälligkeitsdatum unter Angabe der Rechnungsnummer.'
	},
	mails: MAIL_DEFAULTS,
	imap: { enabled: false, host: '', port: 993, secure: true, user: '', password: '', mailbox: 'INBOX', sentMailbox: 'Sent' },
	monitor: { warnDays: 21 },
	push: { publicKey: '', privateKey: '' },
	sync: { inquiryId: 0, bookingId: 0, cancelledAt: '', quoteResponseId: 0 },
	imapStand: { mailbox: '', uidValidity: '', lastUid: 0, lastSync: '', lastError: '' },
	taeglich: { day: '' }
};

const cache = new Map<string, { at: number; value: unknown }>();

export async function getSetting<K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> {
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < 2000) return hit.value as SettingsMap[K];
	const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
	let value: SettingsMap[K] = structuredClone(DEFAULTS[key]);
	if (row) {
		try {
			const parsed = JSON.parse(row.value);
			value = Array.isArray(parsed) ? parsed : { ...value, ...parsed };
		} catch {
			// Standardwerte
		}
	}
	cache.set(key, { at: Date.now(), value });
	return value;
}

export async function setSetting<K extends keyof SettingsMap>(key: K, value: SettingsMap[K]): Promise<void> {
	const json = JSON.stringify(value);
	const updatedAt = new Date().toISOString();
	await db.insert(settings).values({ key, value: json, updatedAt }).onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt } });
	cache.delete(key);
}
