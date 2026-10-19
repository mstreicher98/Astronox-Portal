import { act, bad, type Fields } from '$lib/server/forms';
import { syncInbox, testImap } from '$lib/server/imap';
import { verifySmtp } from '$lib/server/mail';
import { MS365, microsoftToken, tokenRoles } from '$lib/server/microsoft';
import { encrypt } from '$lib/server/secret';
import { getSetting, setSetting } from '$lib/server/settings';
import type { MailAuth } from '$lib/shared/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [smtp, imap, stand, microsoft] = await Promise.all([getSetting('smtp'), getSetting('imap'), getSetting('imapStand'), getSetting('microsoft')]);
	// Passwörter und Schlüssel nie an den Browser – nur ob einer gesetzt ist
	return {
		smtp: { ...smtp, auth: smtp.auth ?? 'passwort', password: '', hasPassword: !!smtp.password },
		imap: { ...imap, auth: imap.auth ?? 'passwort', password: '', hasPassword: !!imap.password },
		microsoft: { ...microsoft, clientSecret: '', hasSecret: !!microsoft.clientSecret },
		stand
	};
};

const AUTHS: readonly MailAuth[] = ['passwort', 'microsoft'];

async function saveSmtp(f: Fields) {
	const cur = await getSetting('smtp');
	const auth = f.oneOf('auth', AUTHS, 'passwort');
	const port = f.int('port') ?? 587;
	const password = f.str('password', 500);
	// Microsoft 365 hat feste Server
	const server = auth === 'microsoft' ? MS365.smtp : { host: f.str('host', 200) ?? '', port, secure: f.has('secure') ? f.bool('secure') : port === 465 };
	const from = f.email('from') ?? 'office@astronox.dev';
	await setSetting('smtp', {
		...server,
		// Microsoft 365 meldet sich immer mit einem Postfach an – leer = Absender
		user: f.str('user', 200) ?? (auth === 'microsoft' ? from : ''),
		// Bei Microsoft 365 kein Passwort nötig – ein altes bleibt für den Rückweg gespeichert
		password: password ? encrypt(password) : cur.password,
		from,
		fromName: f.str('fromName', 100) ?? '',
		inbox: f.email('inbox') ?? 'office@astronox.dev',
		auth
	});
}

async function saveImap(f: Fields) {
	const cur = await getSetting('imap');
	const smtp = await getSetting('smtp');
	const same = f.bool('sameAsSmtp');
	const auth = same ? (smtp.auth ?? 'passwort') : f.oneOf('auth', AUTHS, 'passwort');
	const password = f.str('password', 500);
	const server = auth === 'microsoft' ? MS365.imap : { host: f.str('host', 200) ?? '', port: f.int('port') ?? 993, secure: f.bool('secure') };
	await setSetting('imap', {
		enabled: f.bool('enabled'),
		...server,
		user: same ? smtp.user || (auth === 'microsoft' ? smtp.from : '') : (f.str('user', 200) ?? ''),
		password: same ? smtp.password : password ? encrypt(password) : cur.password,
		mailbox: f.str('mailbox', 200) ?? 'INBOX',
		// Bei Microsoft 365 nicht im Formular – Exchange legt Gesendetes selbst ab
		sentMailbox: f.has('sentMailbox') ? (f.str('sentMailbox', 200) ?? '') : cur.sentMailbox,
		auth
	});
}

async function saveMicrosoft(f: Fields) {
	const cur = await getSetting('microsoft');
	const secret = f.str('clientSecret', 500);
	const tenantId = f.str('tenantId', 100) ?? '';
	const clientId = f.str('clientId', 100) ?? '';
	const objectId = f.str('objectId', 100) ?? '';
	if (objectId && (objectId === tenantId || objectId === clientId)) {
		bad('Die Objekt-ID ist dieselbe wie die Verzeichnis- oder Anwendungs-ID. Du brauchst die Objekt-ID aus „Unternehmensanwendungen“ → Astronox Portal.');
	}
	await setSetting('microsoft', {
		tenantId,
		clientId,
		clientSecret: secret ? encrypt(secret) : cur.clientSecret,
		objectId,
		secretExpires: f.day('secretExpires') ?? ''
	});
}

/** Test-Knöpfe speichern zuerst, damit genau die eingegebenen Werte geprüft werden */
export const actions: Actions = {
	smtp: act(async (_e, f) => {
		await saveSmtp(f);
		return { message: 'SMTP gespeichert – gilt für Webseite und Portal' };
	}),

	smtp_test: act(async (_e, f) => {
		await saveSmtp(f);
		const err = await verifySmtp();
		return { message: err ? `Gespeichert, aber die Verbindung klappt nicht: ${err}` : 'Gespeichert – Verbindung zum Mailserver klappt ✦' };
	}),

	imap: act(async (_e, f) => {
		await saveImap(f);
		return { message: 'IMAP gespeichert' };
	}),

	imap_test: act(async (_e, f) => {
		await saveImap(f);
		const r = await testImap();
		if (!r.ok) return { message: `Verbindung fehlgeschlagen: ${r.error}` };
		return { message: `Verbunden – Ordner: ${r.folders.slice(0, 12).join(', ')}`, folders: r.folders };
	}),

	microsoft: act(async (_e, f) => {
		await saveMicrosoft(f);
		return { message: 'Microsoft 365 gespeichert – gilt für Webseite und Portal' };
	}),

	/** Holt ein neues Token und prüft, ob die Berechtigungen samt Zustimmung drin sind */
	microsoft_test: act(async (_e, f) => {
		await saveMicrosoft(f);
		let token: string;
		try {
			token = await microsoftToken(await getSetting('microsoft'), { fresh: true });
		} catch (err) {
			return { message: `Gespeichert, aber: ${(err as Error).message}` };
		}
		const roles = tokenRoles(token);
		const missing = ['SMTP.SendAsApp', 'IMAP.AccessAsApp'].filter((r) => !roles.includes(r));
		if (missing.length) {
			return { message: `Anmeldung bei Microsoft klappt, aber es fehlt: ${missing.join(', ')} – in Entra unter API-Berechtigungen hinzufügen und die Administratorzustimmung erteilen.` };
		}
		return { message: 'Anmeldung bei Microsoft klappt, Berechtigungen passen ✦ Jetzt Versand und Posteingang testen.' };
	}),

	abrufen: act(async () => {
		const r = await syncInbox();
		return { message: r.error ? `Fehler: ${r.error}` : `${r.fetched} Mail(s) abgerufen` };
	})
};
