/**
 * Passwort-Tresor: verschlüsselt wird im Browser mit dem Master-Passwort, der Server
 * speichert nur Chiffretext. PBKDF2-SHA-256 leitet den Schlüssel ab, jeder Eintrag ist
 * ein JSON mit AES-256-GCM (eigener Zufalls-IV). Web Crypto – läuft genauso in Node (Tests).
 */

import { cleanOtp, type Otp } from './otp';

/** Empfehlung von OWASP für PBKDF2-HMAC-SHA-256 */
export const ITERATIONS = 600_000;
export const MIN_MASTER = 12;
const CHECK = 'astronox-tresor';

export interface Sealed {
	iv: string;
	data: string;
}

export interface VaultField {
	label: string;
	value: string;
	/** verdeckt anzeigen wie ein Passwort */
	secret: boolean;
}

export interface VaultEntry {
	title: string;
	username: string;
	password: string;
	urls: string[];
	notes: string;
	category: string;
	favorite: boolean;
	fields: VaultField[];
	/** Schlüssel für den Authenticator (2FA-Codes) */
	otp: Otp | null;
}

export const emptyEntry = (): VaultEntry => ({ title: '', username: '', password: '', urls: [], notes: '', category: '', favorite: false, fields: [], otp: null });

/** Fehlende Felder ergänzen – so bleiben auch ältere Einträge lesbar */
export function normalize(e: Partial<VaultEntry>): VaultEntry {
	const str = (v: unknown) => (typeof v === 'string' ? v : '');
	return {
		title: str(e.title),
		username: str(e.username),
		password: str(e.password),
		urls: Array.isArray(e.urls) ? e.urls.filter((u): u is string => typeof u === 'string') : [],
		notes: str(e.notes),
		category: str(e.category),
		favorite: e.favorite === true,
		fields: Array.isArray(e.fields) ? e.fields.map((f) => ({ label: str(f?.label), value: str(f?.value), secret: f?.secret === true })) : [],
		otp: cleanOtp(e.otp)
	};
}

/** Vor dem Speichern: Leerzeichen weg, leere Links und Felder raus, Links mit https:// */
export function tidy(e: VaultEntry): VaultEntry {
	return {
		title: e.title.trim(),
		username: e.username.trim(),
		password: e.password,
		urls: e.urls.map((u) => withScheme(u.trim())).filter(Boolean),
		notes: e.notes.trim(),
		category: e.category.trim(),
		favorite: e.favorite,
		fields: e.fields.map((f) => ({ label: f.label.trim(), value: f.value, secret: f.secret })).filter((f) => f.label || f.value),
		otp: cleanOtp(e.otp)
	};
}

const withScheme = (u: string) => (!u || /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`);

/** Nur http(s) wird zum Link – alles andere bleibt Text */
export const linkHref = (u: string) => (/^https?:\/\//i.test(u) ? u : null);

export function linkHost(u: string): string {
	try {
		return new URL(u).host.replace(/^www\./, '');
	} catch {
		return u;
	}
}

/* ------------------------------------------------------------------ Verschlüsselung */

function b64(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

export async function deriveKey(password: string, salt: string, iterations = ITERATIONS): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
	return { iv: b64(iv), data: b64(new Uint8Array(data)) };
}

/** Wirft bei falschem Schlüssel oder veränderten Daten */
export async function unseal<T = unknown>(key: CryptoKey, s: Sealed): Promise<T> {
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.data));
	return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/* ------------------------------------------------------------------ Entsperren mit Passkey */

/**
 * Wie deriveKey, aber als Rohbytes – nur, um den Schlüssel einmalig für einen Passkey zu
 * verpacken. Gleiche Bytes wie deriveKey (die ersten 256 Bit aus PBKDF2).
 */
export async function deriveRaw(password: string, salt: string, iterations = ITERATIONS): Promise<Uint8Array<ArrayBuffer>> {
	const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations }, base, 256));
}

export const keyFromRaw = (raw: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

/** Schlüssel aus dem PRF-Ergebnis eines Passkeys (WebAuthn-Erweiterung „prf“) */
export async function passkeyKey(prf: BufferSource): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode('astronox-tresor-passkey') },
		base,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/** Tresor-Schlüssel mit dem Passkey verpacken … */
export const wrapKey = (passkey: CryptoKey, raw: Uint8Array) => seal(passkey, b64(raw));

/** … und wieder auspacken; wirft, wenn es der falsche Passkey ist */
export async function unwrapKey(passkey: CryptoKey, s: Sealed): Promise<CryptoKey> {
	return keyFromRaw(unb64(await unseal<string>(passkey, s)));
}

/** Prüfwert für das Master-Passwort */
export const makeCheck = (key: CryptoKey) => seal(key, CHECK);

export async function verify(key: CryptoKey, check: Sealed): Promise<boolean> {
	try {
		return (await unseal(key, check)) === CHECK;
	} catch {
		return false;
	}
}

/* ------------------------------------------------------------------ Generator und Stärke */

export interface GenOptions {
	length: number;
	lower: boolean;
	upper: boolean;
	digits: boolean;
	symbols: boolean;
}

export const GEN_DEFAULTS: GenOptions = { length: 20, lower: true, upper: true, digits: true, symbols: true };

/** Ohne leicht verwechselbare Zeichen (l, I, O, 0, 1) – falls man es doch einmal abtippen muss */
const SETS = {
	lower: 'abcdefghijkmnopqrstuvwxyz',
	upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
	digits: '23456789',
	symbols: '!#$%&*+-=?@_~'
} as const;

/** Gleichverteilte Zufallszahl 0 … n-1 (ohne Modulo-Verzerrung) */
function randomIndex(n: number): number {
	const limit = Math.floor(0x1_0000_0000 / n) * n;
	const buf = new Uint32Array(1);
	do crypto.getRandomValues(buf);
	while (buf[0] >= limit);
	return buf[0] % n;
}

export function generatePassword(o: GenOptions): string {
	const sets = (Object.keys(SETS) as (keyof typeof SETS)[]).filter((k) => o[k]).map((k) => SETS[k]);
	if (!sets.length) sets.push(SETS.lower);
	const length = Math.max(sets.length, Math.min(128, Math.round(o.length)));
	const all = sets.join('');
	// aus jeder gewählten Gruppe mindestens ein Zeichen, der Rest zufällig – dann mischen
	const chars = sets.map((s) => s[randomIndex(s.length)]);
	while (chars.length < length) chars.push(all[randomIndex(all.length)]);
	for (let i = chars.length - 1; i > 0; i--) {
		const j = randomIndex(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join('');
}

export const STRENGTH = ['Schwach', 'Mittel', 'Gut', 'Sehr stark'] as const;

/** Grobe Schätzung in Bit: Zeichenvorrat × Länge; viele Wiederholungen zählen weniger */
export function strength(pw: string): { bits: number; level: 0 | 1 | 2 | 3 } {
	if (!pw) return { bits: 0, level: 0 };
	let pool = 0;
	if (/[a-z]/.test(pw)) pool += 26;
	if (/[A-Z]/.test(pw)) pool += 26;
	if (/\d/.test(pw)) pool += 10;
	if (/[^a-zA-Z\d]/.test(pw)) pool += 33;
	const chars = [...pw];
	const unique = new Set(chars).size;
	const effective = Math.min(chars.length, unique * 2);
	const bits = Math.round(effective * Math.log2(pool));
	return { bits, level: bits >= 80 ? 3 : bits >= 60 ? 2 : bits >= 40 ? 1 : 0 };
}
