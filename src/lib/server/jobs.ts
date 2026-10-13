import { and, eq, gte, isNotNull, lt, lte } from 'drizzle-orm';
import { addDays, date, dayOf, today } from '$lib/shared/format';
import { notify } from './activity';
import { purgeSessions } from './auth';
import { dailyBackup } from './backup';
import { db } from './db';
import { domains, monitors, notifications } from './db/schema';
import { overdueReminders, recurringInvoices } from './documents';
import { syncInbox } from './imap';
import { purgeChecks, runMonitors } from './monitor';
import { getSetting, setSetting } from './settings';
import { syncWebsite } from './sync';

/**
 * Aufgaben im Hintergrund – laufen im Portal-Container, solange er läuft:
 *  - alle 15 s: neue Anfragen und Termine von der Webseite
 *  - alle 30 s: fällige Prüfungen der Kundenseiten
 *  - alle 2 min: Posteingang (wenn IMAP eingerichtet ist)
 *  - einmal am Tag ab 3 Uhr: Sicherung, Abo-Rechnungen, Fristen, Aufräumen
 */

let started = false;

function every(ms: number, fn: () => Promise<unknown>, delay = 0) {
	const run = () => fn().catch((err) => console.error('[aufgabe]', err));
	setTimeout(() => {
		void run();
		setInterval(run, ms).unref();
	}, delay).unref();
}

/** Einmal pro Woche warnen, nicht bei jedem Lauf */
async function warnOnce(title: string, body: string, url: string) {
	const [recent] = await db
		.select({ id: notifications.id })
		.from(notifications)
		.where(and(eq(notifications.title, title), gte(notifications.createdAt, new Date(Date.now() - 7 * 86_400_000).toISOString())))
		.limit(1);
	if (!recent) await notify({ kind: 'frist', title, body, url });
}

export async function expiryWarnings() {
	const { warnDays } = await getSetting('monitor');
	const limit = addDays(today(), warnDays);
	const soonDomains = await db
		.select()
		.from(domains)
		.where(and(isNotNull(domains.expiresOn), lte(domains.expiresOn, limit)));
	for (const d of soonDomains) {
		if (d.autoRenew && d.expiresOn! >= today()) continue;
		await warnOnce(`Domain läuft ab: ${d.name}`, `am ${date(d.expiresOn)}${d.registrar ? ` (${d.registrar})` : ''}`, '/hosting');
	}
	const soonCerts = await db
		.select()
		.from(monitors)
		.where(and(eq(monitors.enabled, true), isNotNull(monitors.sslExpiresAt), lt(monitors.sslExpiresAt, new Date(`${limit}T23:59:59Z`).toISOString())));
	for (const m of soonCerts) {
		// Zertifikate von Cloudflare und Let's Encrypt erneuern sich 30 Tage vorher selbst – nur knapp davor warnen
		if (Date.parse(m.sslExpiresAt!) - Date.now() > 14 * 86_400_000) continue;
		await warnOnce(`Zertifikat läuft ab: ${m.name}`, `am ${date(dayOf(m.sslExpiresAt!))}`, '/hosting');
	}
}

async function daily() {
	const state = await getSetting('taeglich');
	const now = new Date();
	const hour = Number(new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', hour: 'numeric', hourCycle: 'h23' }).format(now));
	if (state.day === today() || hour < 3) return;
	await setSetting('taeglich', { day: today() });
	const steps: [string, () => Promise<unknown>][] = [
		['Sicherung', dailyBackup],
		['Abo-Rechnungen', recurringInvoices],
		['Überfällige Rechnungen', overdueReminders],
		['Fristen', expiryWarnings],
		['Aufräumen', async () => {
			await purgeSessions();
			await purgeChecks(30);
			await db.delete(notifications).where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, new Date(Date.now() - 90 * 86_400_000).toISOString())));
		}]
	];
	for (const [name, fn] of steps) {
		try {
			await fn();
		} catch (err) {
			console.error(`[täglich] ${name}:`, err);
			await notify({ kind: 'system', title: `Fehler bei „${name}“`, body: (err as Error).message, url: '/einstellungen/sicherungen', push: false });
		}
	}
}

export function startJobs() {
	if (started || process.env.PORTAL_JOBS === 'aus') return;
	started = true;
	every(15_000, syncWebsite, 2_000);
	every(30_000, runMonitors, 8_000);
	every(120_000, syncInbox, 15_000);
	every(10 * 60_000, daily, 30_000);
}
