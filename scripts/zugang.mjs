/**
 * Notfall-Zugang zum Portal – im Container ausführen:
 *   Portainer → Container „portal“ → Console → /bin/sh →  node scripts/zugang.mjs <befehl>
 *
 * Befehle:
 *   status                    Konten anzeigen
 *   passwort [E-Mail]         neues Zufallspasswort setzen und einmal anzeigen
 *   2fa [E-Mail]              Zwei-Faktor zurücksetzen (beim nächsten Anmelden neu verbinden)
 *   abmelden                  alle Geräte abmelden
 *   anlegen <E-Mail> <Name>   Konto anlegen (nur wenn noch keines existiert)
 *
 * Option --aus-env NAME: Passwort aus der Umgebungsvariable NAME statt Zufall (für Tests).
 */
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

const scrypt = promisify(scryptCb);

// .env im Projektordner lesen (nur Entwicklung), ohne Zusatzpaket
if (fs.existsSync('.env')) {
	for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
		const m = /^\s*#?\s*([A-Z_]+)=(.*)$/.exec(line);
		if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
	}
}

const dataDir = path.resolve(process.env.DATA_DIR || '/data');
const dbFile = path.join(dataDir, 'astronox.db');
if (!fs.existsSync(dbFile)) {
	console.error(`Datenbank nicht gefunden: ${dbFile} (DATA_DIR setzen)`);
	process.exit(1);
}
const db = createClient({ url: `file:${dbFile}`, timeout: 8000 });

const args = process.argv.slice(2);
const envFlag = args.indexOf('--aus-env');
const envName = envFlag >= 0 ? args.splice(envFlag, 2)[1] : null;
const [cmd = 'status', ...rest] = args;

async function hash(pw) {
	const salt = randomBytes(16);
	const N = 2 ** 15;
	const h = await scrypt(pw, salt, 64, { N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
	return `scrypt$${N}$8$1$${salt.toString('base64url')}$${h.toString('base64url')}`;
}

function newPassword() {
	if (envName) {
		const v = process.env[envName];
		if (!v || v.length < 12) throw new Error(`Umgebungsvariable ${envName} fehlt oder ist kürzer als 12 Zeichen`);
		return { pw: v, show: false };
	}
	return { pw: randomBytes(15).toString('base64url'), show: true };
}

async function findUser(email) {
	const r = email
		? await db.execute({ sql: 'SELECT * FROM portal_users WHERE lower(email) = lower(?)', args: [email] })
		: await db.execute('SELECT * FROM portal_users ORDER BY id LIMIT 1');
	if (!r.rows.length) throw new Error(email ? `Kein Konto mit ${email}` : 'Es gibt noch kein Konto');
	return r.rows[0];
}

try {
	if (cmd === 'status') {
		const r = await db.execute('SELECT id, email, name, totp_enabled, last_login_at FROM portal_users');
		if (!r.rows.length) console.log('Noch kein Konto. Einrichten unter /einrichten (Code steht im Protokoll) oder: anlegen <E-Mail> <Name>');
		for (const u of r.rows) console.log(`#${u.id} ${u.email} (${u.name}) · 2FA ${u.totp_enabled ? 'aktiv' : 'nicht eingerichtet'} · zuletzt ${u.last_login_at ?? 'nie'}`);
	} else if (cmd === 'passwort') {
		const u = await findUser(rest[0]);
		const { pw, show } = newPassword();
		await db.execute({ sql: 'UPDATE portal_users SET password_hash = ? WHERE id = ?', args: [await hash(pw), u.id] });
		await db.execute({ sql: 'DELETE FROM portal_sessions WHERE user_id = ?', args: [u.id] });
		console.log(`Neues Passwort für ${u.email} gesetzt, alle Geräte abgemeldet.`);
		if (show) console.log(`Passwort: ${pw}\nBitte nach dem Anmelden unter Einstellungen → Sicherheit ändern.`);
	} else if (cmd === '2fa') {
		const u = await findUser(rest[0]);
		await db.execute({ sql: "UPDATE portal_users SET totp_enabled = 0, totp_secret = NULL, recovery_codes = '[]' WHERE id = ?", args: [u.id] });
		await db.execute({ sql: 'DELETE FROM portal_sessions WHERE user_id = ?', args: [u.id] });
		console.log(`Zwei-Faktor für ${u.email} zurückgesetzt. Beim nächsten Anmelden wird eine App neu verbunden.`);
	} else if (cmd === 'abmelden') {
		const r = await db.execute('DELETE FROM portal_sessions');
		console.log(`${r.rowsAffected} Sitzung(en) beendet.`);
	} else if (cmd === 'anlegen') {
		const [email, ...nameParts] = rest;
		if (!email || !nameParts.length) throw new Error('Aufruf: anlegen <E-Mail> <Name>');
		const exists = await db.execute('SELECT count(*) AS n FROM portal_users');
		if (Number(exists.rows[0].n) > 0) throw new Error('Es gibt schon ein Konto – dafür „passwort“ verwenden.');
		const { pw, show } = newPassword();
		await db.execute({ sql: 'INSERT INTO portal_users (email, name, password_hash) VALUES (?, ?, ?)', args: [email.toLowerCase(), nameParts.join(' '), await hash(pw)] });
		console.log(`Konto ${email} angelegt. Beim ersten Anmelden wird die Authenticator-App verbunden.`);
		if (show) console.log(`Passwort: ${pw}`);
	} else {
		console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
	}
} catch (err) {
	console.error(err.message);
	process.exitCode = 1;
}
