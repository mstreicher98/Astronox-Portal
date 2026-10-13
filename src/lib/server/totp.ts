import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Einmalcodes nach RFC 6238 (Google Authenticator, Microsoft Authenticator, 1Password …) */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of buf) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

export function base32Decode(s: string): Buffer {
	const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const c of clean) {
		value = (value << 5) | ALPHABET.indexOf(c);
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

export const newSecret = () => base32Encode(randomBytes(20));

export function codeAt(secret: string, counter: number): string {
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(counter));
	const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
	const o = h[h.length - 1] & 15;
	const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
	return String(n % 1_000_000).padStart(6, '0');
}

/** Prüft einen Code mit ±1 Zeitfenster (30 s) Toleranz */
export function verifyCode(secret: string, code: string, at = Date.now()): boolean {
	const given = code.replace(/\s/g, '');
	if (!/^\d{6}$/.test(given)) return false;
	const counter = Math.floor(at / 30_000);
	for (const d of [-1, 0, 1]) {
		const expected = codeAt(secret, counter + d);
		if (timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return true;
	}
	return false;
}

export function otpauthUrl(secret: string, account: string, issuer = 'Astronox Portal'): string {
	return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
