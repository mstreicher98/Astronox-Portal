import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { DATA_DIR } from './db';

/**
 * Gemeinsamer Schlüssel von Webseite und Portal. Er liegt neben der Datenbank
 * in /data/.schluessel und wird von der App angelegt, die zuerst startet.
 * Alternativ in beiden Diensten APP_SECRET setzen.
 *
 * Daraus abgeleitet:
 *  - „verschluesselung“: Passwörter in der Tabelle settings (AES-256-GCM)
 *  - „vorschau“: signierte Links, mit denen das Portal Entwürfe anzeigt
 *
 * Gleiches Format wie auf der Webseite (src/lib/server/secret.ts) – beide müssen zusammenpassen.
 */

let master: Buffer | null = null;

function masterKey(): Buffer {
	if (master) return master;
	if (env.APP_SECRET && env.APP_SECRET.length >= 32) {
		master = Buffer.from(env.APP_SECRET, 'utf8');
		return master;
	}
	const file = path.join(DATA_DIR, '.schluessel');
	try {
		fs.writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
	}
	master = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
	return master;
}

const derived = new Map<string, Buffer>();

function key(purpose: 'verschluesselung' | 'vorschau'): Buffer {
	let k = derived.get(purpose);
	if (!k) {
		k = Buffer.from(hkdfSync('sha256', masterKey(), 'astronox', purpose, 32));
		derived.set(purpose, k);
	}
	return k;
}

/** Klartext → „v1:…“ */
export function encrypt(plain: string): string {
	const iv = randomBytes(12);
	const c = createCipheriv('aes-256-gcm', key('verschluesselung'), iv);
	const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
	return `v1:${Buffer.concat([iv, c.getAuthTag(), data]).toString('base64url')}`;
}

/** „v1:…“ → Klartext; leer, wenn nichts oder nicht lesbar */
export function decrypt(value: string | null | undefined): string {
	if (!value?.startsWith('v1:')) return '';
	try {
		const raw = Buffer.from(value.slice(3), 'base64url');
		const d = createDecipheriv('aes-256-gcm', key('verschluesselung'), raw.subarray(0, 12));
		d.setAuthTag(raw.subarray(12, 28));
		return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
	} catch {
		return '';
	}
}

/** Prüft einen Vorschau-Link aus dem Portal: „<ablauf>.<signatur>“ */
export function validPreview(token: string | null): boolean {
	if (!token) return false;
	const m = /^(\d{10})\.([\w-]{43})$/.exec(token);
	if (!m || Number(m[1]) * 1000 < Date.now()) return false;
	const expected = createHmac('sha256', key('vorschau')).update(`vorschau:${m[1]}`).digest();
	const given = Buffer.from(m[2], 'base64url');
	return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Vorschau-Link für die Webseite, gültig für ein paar Stunden */
export function previewToken(hours = 6): string {
	const exp = String(Math.floor(Date.now() / 1000) + hours * 3600);
	const sig = createHmac('sha256', key('vorschau')).update(`vorschau:${exp}`).digest('base64url');
	return `${exp}.${sig}`;
}
