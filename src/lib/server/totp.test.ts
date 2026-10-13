import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, codeAt, verifyCode } from './totp';

describe('totp', () => {
	// Testvektor aus RFC 6238 (SHA-1, Schlüssel „12345678901234567890“)
	const secret = base32Encode(Buffer.from('12345678901234567890'));

	it('rechnet wie RFC 6238', () => {
		expect(codeAt(secret, Math.floor(59 / 30))).toBe('287082');
		expect(codeAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
	});

	it('akzeptiert das Nachbarfenster, aber nicht weiter', () => {
		const at = 1111111109_000;
		expect(verifyCode(secret, '081804', at)).toBe(true);
		expect(verifyCode(secret, '081804', at + 30_000)).toBe(true);
		expect(verifyCode(secret, '081804', at + 95_000)).toBe(false);
	});

	it('base32 hin und zurück', () => {
		const b = Buffer.from([1, 2, 3, 250, 99]);
		expect(base32Decode(base32Encode(b))).toEqual(b);
	});
});
