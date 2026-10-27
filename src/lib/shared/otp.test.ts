import { describe, expect, it } from 'vitest';
import { codeAt, newSecret } from '../server/totp';
import { base32Decode, base32Encode, cleanOtp, groupCode, otpCode, parseMigration, parseOtp, secondsLeft, type OtpAlgorithm } from './otp';

const ascii = (s: string) => base32Encode(new TextEncoder().encode(s));

describe('Codes nach RFC 6238', () => {
	// Testwerte aus Anhang B der RFC (8 Stellen)
	const cases: [OtpAlgorithm, string, number, string][] = [
		['SHA1', '12345678901234567890', 59, '94287082'],
		['SHA1', '12345678901234567890', 1111111109, '07081804'],
		['SHA1', '12345678901234567890', 20000000000, '65353130'],
		['SHA256', '12345678901234567890123456789012', 59, '46119246'],
		['SHA256', '12345678901234567890123456789012', 1234567890, '91819424'],
		['SHA512', '1234567890123456789012345678901234567890123456789012345678901234', 59, '90693936'],
		['SHA512', '1234567890123456789012345678901234567890123456789012345678901234', 2000000000, '38618901']
	];
	for (const [alg, key, t, code] of cases) {
		it(`${alg} bei ${t}`, async () => {
			expect(await otpCode({ secret: ascii(key), algorithm: alg, digits: 8, period: 30 }, t * 1000)).toBe(code);
		});
	}

	it('stimmt mit der Anmeldung des Portals überein', async () => {
		const secret = newSecret();
		const at = Date.UTC(2026, 9, 27, 12, 0, 5);
		expect(await otpCode({ secret, algorithm: 'SHA1', digits: 6, period: 30 }, at)).toBe(codeAt(secret, Math.floor(at / 30_000)));
	});

	it('zählt die Sekunden bis zum nächsten Code', () => {
		const o = { secret: ascii('12345678901234567890'), algorithm: 'SHA1' as const, digits: 6, period: 30 };
		expect(secondsLeft(o, 60_000)).toBe(30);
		expect(secondsLeft(o, 89_000)).toBe(1);
		expect(groupCode('123456')).toBe('123 456');
		expect(groupCode('12345678')).toBe('1234 5678');
	});
});

describe('Base32', () => {
	it('hin und zurück', () => {
		const bytes = Uint8Array.from({ length: 20 }, (_, i) => i * 13);
		expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
		expect(base32Decode('jbsw y3dp-ehpk 3pxp')).toEqual(base32Decode('JBSWY3DPEHPK3PXP'));
		expect(base32Decode('nicht gültig!')).toBeNull();
	});
});

describe('Schlüssel und Links lesen', () => {
	it('nimmt einen Schlüssel mit Leerzeichen', () => {
		expect(parseOtp('jbsw y3dp ehpk 3pxp')).toEqual({ secret: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30, issuer: '', account: '' });
	});

	it('liest otpauth-Links mit Anbieter und Konto', () => {
		expect(parseOtp('otpauth://totp/Example%20Shop:max%40beispiel.at?secret=JBSWY3DPEHPK3PXP&issuer=Example%20Shop&algorithm=SHA256&digits=8&period=60')).toEqual({
			secret: 'JBSWY3DPEHPK3PXP',
			algorithm: 'SHA256',
			digits: 8,
			period: 60,
			issuer: 'Example Shop',
			account: 'max@beispiel.at'
		});
		expect(parseOtp('otpauth://totp/max@beispiel.at?secret=JBSWY3DPEHPK3PXP')).toMatchObject({ issuer: '', account: 'max@beispiel.at' });
	});

	it('lehnt Unbrauchbares ab', () => {
		expect(parseOtp('otpauth://hotp/X?secret=JBSWY3DPEHPK3PXP&counter=1')).toBeNull();
		expect(parseOtp('otpauth://totp/X?secret=')).toBeNull();
		expect(parseOtp('hallo')).toBeNull();
		expect(cleanOtp({ secret: 'JBSWY3DP' })).toBeNull();
	});
});

describe('Export aus Google Authenticator', () => {
	// kleiner Protobuf-Schreiber für den Test
	const varint = (n: number) => {
		const out: number[] = [];
		do {
			out.push((n & 127) | (n > 127 ? 128 : 0));
			n >>>= 7;
		} while (n);
		return out;
	};
	const bytesField = (f: number, b: Uint8Array | number[]) => [...varint(f * 8 + 2), ...varint(b.length), ...b];
	const numField = (f: number, n: number) => [...varint(f * 8), ...varint(n)];
	const text = (s: string) => [...new TextEncoder().encode(s)];

	it('liest mehrere Konten und überspringt HOTP', () => {
		const secret = new TextEncoder().encode('12345678901234567890');
		const a = [...bytesField(1, secret), ...bytesField(2, text('Shop:max@beispiel.at')), ...bytesField(3, text('Shop')), ...numField(4, 1), ...numField(5, 1), ...numField(6, 2)];
		const b = [...bytesField(1, secret), ...bytesField(2, text('anna')), ...numField(4, 2), ...numField(5, 2), ...numField(6, 2)];
		const h = [...bytesField(1, secret), ...bytesField(2, text('zähler')), ...numField(6, 1)];
		const payload = Uint8Array.from([...bytesField(1, a), ...bytesField(1, b), ...bytesField(1, h), ...numField(2, 1)]);
		const data = encodeURIComponent(btoa(String.fromCharCode(...payload)));
		expect(parseMigration(`otpauth-migration://offline?data=${data}`)).toEqual([
			{ secret: base32Encode(secret), algorithm: 'SHA1', digits: 6, period: 30, issuer: 'Shop', account: 'max@beispiel.at' },
			{ secret: base32Encode(secret), algorithm: 'SHA256', digits: 8, period: 30, issuer: '', account: 'anna' }
		]);
	});

	it('erkennt kaputte oder fremde Links', () => {
		expect(parseMigration('otpauth-migration://offline?data=%%%')).toBeNull();
		expect(parseMigration('https://example.com')).toBeNull();
	});
});
