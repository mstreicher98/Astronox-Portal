/**
 * Authenticator: Einmalcodes nach RFC 6238 (TOTP) im Browser – wie Google oder Microsoft
 * Authenticator. Die Schlüssel liegen verschlüsselt im Passwort-Tresor ($lib/shared/tresor).
 * Web Crypto – läuft genauso in Node (Tests).
 */

export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface Otp {
	/** Base32 in Großbuchstaben, ohne Leerzeichen */
	secret: string;
	algorithm: OtpAlgorithm;
	digits: number;
	period: number;
}

/** Was ein QR-Code oder Link außer dem Schlüssel noch verrät */
export interface OtpImport extends Otp {
	issuer: string;
	account: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const HASH: Record<OtpAlgorithm, string> = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };

const cleanSecret = (s: string) => s.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');

export function base32Decode(s: string): Uint8Array<ArrayBuffer> | null {
	const clean = cleanSecret(s);
	if (!clean || /[^A-Z2-7]/.test(clean)) return null;
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const c of clean) {
		value = ((value << 5) | ALPHABET.indexOf(c)) & 0xffff;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Uint8Array.from(out);
}

export function base32Encode(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of bytes) {
		value = ((value << 8) | byte) & 0xffff;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

const algorithm = (v: unknown): OtpAlgorithm => {
	const a = String(v ?? '').toUpperCase().replace('-', '');
	return a === 'SHA256' || a === 'SHA512' ? a : 'SHA1';
};
const digits = (v: unknown) => ([6, 7, 8].includes(Number(v)) ? Number(v) : 6);
const period = (v: unknown) => {
	const n = Number(v);
	return Number.isInteger(n) && n >= 10 && n <= 300 ? n : 30;
};

/** Gespeicherte Einstellungen prüfen – null, wenn kein brauchbarer Schlüssel drin ist */
export function cleanOtp(v: unknown): Otp | null {
	const o = (v ?? {}) as Partial<Otp>;
	if (typeof o.secret !== 'string') return null;
	const secret = cleanSecret(o.secret);
	if ((base32Decode(secret)?.length ?? 0) < 10) return null;
	return { secret, algorithm: algorithm(o.algorithm), digits: digits(o.digits), period: period(o.period) };
}

/** Schlüssel (Base32) oder otpauth://totp/…-Link – null, wenn es keiner ist (auch bei HOTP) */
export function parseOtp(input: string): OtpImport | null {
	const s = input.trim();
	if (!/^otpauth:/i.test(s)) {
		const otp = cleanOtp({ secret: s });
		return otp && { ...otp, issuer: '', account: '' };
	}
	const m = /^otpauth:\/\/totp\/([^?]*)(?:\?(.*))?$/i.exec(s);
	if (!m) return null;
	const params = new Map<string, string>();
	for (const pair of (m[2] ?? '').split('&')) {
		const [k, v = ''] = pair.split('=');
		if (k) params.set(k.toLowerCase(), safeDecode(v));
	}
	const otp = cleanOtp({ secret: params.get('secret'), algorithm: params.get('algorithm'), digits: params.get('digits'), period: params.get('period') });
	if (!otp) return null;
	// Bezeichnung „Anbieter:Konto“ oder nur „Konto“; issuer= hat Vorrang
	const label = safeDecode(m[1]);
	const colon = label.indexOf(':');
	const issuer = params.get('issuer') || (colon > 0 ? label.slice(0, colon) : '');
	const account = colon > 0 ? label.slice(colon + 1) : label;
	return { ...otp, issuer: issuer.trim(), account: account.trim() };
}

function safeDecode(s: string): string {
	try {
		return decodeURIComponent(s.replace(/\+/g, '%20'));
	} catch {
		return s;
	}
}

/**
 * Export aus Google Authenticator („Konten übertragen“, otpauth-migration://offline?data=…):
 * mehrere Konten in einem QR-Code, als Protocol Buffer. null, wenn es kein solcher Link ist.
 */
export function parseMigration(input: string): OtpImport[] | null {
	const m = /^otpauth-migration:\/\/offline\?(.*)$/i.exec(input.trim());
	if (!m) return null;
	const raw = m[1].split('&').find((p) => p.startsWith('data='))?.slice(5);
	if (!raw) return null;
	try {
		const b64 = decodeURIComponent(raw).replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
		const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		const out: OtpImport[] = [];
		for (const [field, value] of proto(bytes)) {
			if (field !== 1 || !(value instanceof Uint8Array)) continue;
			const a = migrationAccount(value);
			if (a) out.push(a);
		}
		return out;
	} catch {
		return null;
	}
}

function migrationAccount(buf: Uint8Array): OtpImport | null {
	const text = new TextDecoder();
	let secret: Uint8Array | null = null;
	let name = '';
	let issuer = '';
	let alg = 1;
	let dig = 1;
	let type = 2;
	for (const [field, value] of proto(buf)) {
		if (field === 1 && value instanceof Uint8Array) secret = value;
		else if (field === 2 && value instanceof Uint8Array) name = text.decode(value);
		else if (field === 3 && value instanceof Uint8Array) issuer = text.decode(value);
		else if (field === 4 && typeof value === 'number') alg = value;
		else if (field === 5 && typeof value === 'number') dig = value;
		else if (field === 6 && typeof value === 'number') type = value;
	}
	// 1 = HOTP (zählerbasiert) – kann der Authenticator hier nicht
	if (!secret || type === 1) return null;
	const otp = cleanOtp({ secret: base32Encode(secret), algorithm: ['SHA1', 'SHA1', 'SHA256', 'SHA512'][alg] ?? 'SHA1', digits: dig === 2 ? 8 : 6, period: 30 });
	if (!otp) return null;
	const account = issuer && name.startsWith(`${issuer}:`) ? name.slice(issuer.length + 1) : name;
	return { ...otp, issuer: issuer.trim(), account: account.trim() };
}

/** Minimaler Protobuf-Leser: liefert [Feldnummer, Zahl oder Bytes] */
function* proto(buf: Uint8Array): Generator<[number, number | Uint8Array]> {
	let pos = 0;
	const varint = () => {
		let result = 0;
		let shift = 0;
		let b: number;
		do {
			if (pos >= buf.length) throw new Error('Protobuf zu kurz');
			b = buf[pos++];
			result += (b & 127) * 2 ** shift;
			shift += 7;
		} while (b & 128);
		return result;
	};
	while (pos < buf.length) {
		const tag = varint();
		const field = Math.floor(tag / 8);
		const wire = tag & 7;
		if (wire === 0) yield [field, varint()];
		else if (wire === 2) {
			const len = varint();
			if (pos + len > buf.length) throw new Error('Protobuf zu kurz');
			yield [field, buf.subarray(pos, pos + len)];
			pos += len;
		} else if (wire === 1) pos += 8;
		else if (wire === 5) pos += 4;
		else throw new Error('Protobuf unbekannt');
	}
}

/* ------------------------------------------------------------------ Codes */

export async function otpCode(o: Otp, at = Date.now()): Promise<string> {
	const secret = base32Decode(o.secret);
	if (!secret) throw new Error('Ungültiger Schlüssel');
	const msg = new Uint8Array(8);
	new DataView(msg.buffer).setBigUint64(0, BigInt(Math.floor(at / 1000 / o.period)));
	const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: HASH[o.algorithm] }, false, ['sign']);
	const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
	const off = h[h.length - 1] & 15;
	const n = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
	return String(n % 10 ** o.digits).padStart(o.digits, '0');
}

/** Sekunden, bis der nächste Code kommt */
export const secondsLeft = (o: Otp, at = Date.now()) => o.period - (Math.floor(at / 1000) % o.period);

/** „123456“ → „123 456“, „12345678“ → „1234 5678“ */
export const groupCode = (c: string) => (c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c);
