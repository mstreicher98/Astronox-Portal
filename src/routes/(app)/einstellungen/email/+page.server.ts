import { act, type Fields } from '$lib/server/forms';
import { syncInbox, testImap } from '$lib/server/imap';
import { verifySmtp } from '$lib/server/mail';
import { encrypt } from '$lib/server/secret';
import { getSetting, setSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [smtp, imap, stand] = await Promise.all([getSetting('smtp'), getSetting('imap'), getSetting('imapStand')]);
	// Passwörter nie an den Browser – nur ob eines gesetzt ist
	return {
		smtp: { ...smtp, password: '', hasPassword: !!smtp.password },
		imap: { ...imap, password: '', hasPassword: !!imap.password },
		stand
	};
};

async function saveSmtp(f: Fields) {
	const cur = await getSetting('smtp');
	const port = f.int('port') ?? 587;
	const password = f.str('password', 500);
	await setSetting('smtp', {
		host: f.str('host', 200) ?? '',
		port,
		secure: f.has('secure') ? f.bool('secure') : port === 465,
		user: f.str('user', 200) ?? '',
		password: password ? encrypt(password) : cur.password,
		from: f.email('from') ?? 'office@astronox.dev',
		fromName: f.str('fromName', 100) ?? '',
		inbox: f.email('inbox') ?? 'office@astronox.dev'
	});
}

async function saveImap(f: Fields) {
	const cur = await getSetting('imap');
	const smtp = await getSetting('smtp');
	const same = f.bool('sameAsSmtp');
	const password = f.str('password', 500);
	await setSetting('imap', {
		enabled: f.bool('enabled'),
		host: f.str('host', 200) ?? '',
		port: f.int('port') ?? 993,
		secure: f.bool('secure'),
		user: same ? smtp.user : (f.str('user', 200) ?? ''),
		password: same ? smtp.password : password ? encrypt(password) : cur.password,
		mailbox: f.str('mailbox', 200) ?? 'INBOX',
		sentMailbox: f.str('sentMailbox', 200) ?? ''
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

	abrufen: act(async () => {
		const r = await syncInbox();
		return { message: r.error ? `Fehler: ${r.error}` : `${r.fetched} Mail(s) abgerufen` };
	})
};
