import { decrypt } from './secret';

/**
 * Anmeldung bei Microsoft 365 (Exchange Online) ohne Passwort: Das Portal ist
 * in Microsoft Entra als App registriert und holt sich mit deren geheimem
 * Schlüssel ein Zugangs-Token (Client-Credentials). Damit melden sich SMTP und
 * IMAP über XOAUTH2 beim Postfach an.
 *
 * Gleiche Datei in Webseite und Portal (src/lib/server/microsoft.ts) – Änderungen
 * in beiden nachziehen.
 */

export const MS365 = {
	smtp: { host: 'smtp.office365.com', port: 587, secure: false },
	imap: { host: 'outlook.office365.com', port: 993, secure: true }
};

export interface MicrosoftApp {
	tenantId: string;
	clientId: string;
	/** verschlüsselt („v1:…“) */
	clientSecret: string;
}

/** Bekannte Fehler von Microsoft Entra, verständlich erklärt */
const AADSTS: [string, string][] = [
	['AADSTS7000215', 'Der geheime Schlüssel stimmt nicht – den „Wert“ eintragen, nicht die „Geheimnis-ID“.'],
	['AADSTS7000222', 'Der geheime Schlüssel ist abgelaufen – in Entra einen neuen anlegen.'],
	['AADSTS700016', 'Diese Anwendungs-ID gibt es im Verzeichnis nicht.'],
	['AADSTS90002', 'Diese Verzeichnis-ID (Mandant) gibt es nicht.'],
	['AADSTS900023', 'Die Verzeichnis-ID (Mandant) hat ein falsches Format.']
];

let cached: { key: string; token: string; until: number } | null = null;

/** Gültiges Zugangs-Token – zwischengespeichert bis kurz vor Ablauf (ca. 1 Stunde) */
export async function microsoftToken(app: MicrosoftApp | undefined, opts: { fresh?: boolean } = {}): Promise<string> {
	const tenant = app?.tenantId.trim();
	const client = app?.clientId.trim();
	const secret = decrypt(app?.clientSecret);
	if (!tenant || !client || !secret) throw new Error('Microsoft 365 ist noch nicht vollständig eingerichtet (Einstellungen → E-Mail).');
	const key = `${tenant}|${client}|${secret}`;
	if (!opts.fresh && cached?.key === key && cached.until > Date.now()) return cached.token;

	let res: Response;
	try {
		res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: client,
				client_secret: secret,
				scope: 'https://outlook.office365.com/.default',
				grant_type: 'client_credentials'
			}),
			signal: AbortSignal.timeout(15_000)
		});
	} catch (err) {
		throw new Error(`Microsoft ist nicht erreichbar: ${(err as Error).message}`);
	}
	const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
	if (!res.ok || !data.access_token) {
		const desc = data.error_description?.split(/\r?\n/)[0] || data.error || `HTTP ${res.status}`;
		const known = AADSTS.find(([code]) => desc.startsWith(`${code}:`));
		throw new Error(`Anmeldung bei Microsoft fehlgeschlagen: ${known ? `${known[1]} (${known[0]})` : desc}`);
	}
	cached = { key, token: data.access_token, until: Date.now() + ((Number(data.expires_in) || 3600) - 300) * 1000 };
	return data.access_token;
}

/** Berechtigungen im Token, z. B. IMAP.AccessAsApp und SMTP.SendAsApp */
export function tokenRoles(token: string): string[] {
	try {
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
		return Array.isArray(payload.roles) ? payload.roles : [];
	} catch {
		return [];
	}
}

/** Fehlermeldungen von Exchange Online um den wahrscheinlichen Grund ergänzen */
export function microsoftHint(message: string): string {
	if (/SmtpClientAuthentication is disabled/i.test(message)) {
		return `${message} – SMTP AUTH ist für das Postfach ausgeschaltet (Set-CASMailbox, siehe Anleitung unter Einstellungen → E-Mail).`;
	}
	if (/SendAsDenied|5\.2\.252/i.test(message)) {
		return `${message} – Absender muss die Adresse des Postfachs sein (oder dort „Senden als“ erlauben).`;
	}
	if (/5\.7\.3|AUTHENTICATE failed|Authentication unsuccessful|authentication failed/i.test(message)) {
		return `${message} – Microsoft lässt die App nicht ins Postfach: New-ServicePrincipal und Add-MailboxPermission prüfen (Anleitung unter Einstellungen → E-Mail).`;
	}
	return message;
}
