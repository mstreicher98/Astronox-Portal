import { describe, expect, it } from 'vitest';
import { deriveKey, emptyEntry, generatePassword, linkHref, makeCheck, newSalt, normalize, seal, strength, tidy, unseal, verify } from './tresor';

// wenige Runden – sonst dauern die Tests unnötig lang
const ROUNDS = 1000;

describe('Verschlüsselung', () => {
	it('entschlüsselt mit dem richtigen Master-Passwort', async () => {
		const salt = newSalt();
		const key = await deriveKey('richtig-richtig', salt, ROUNDS);
		const entry = { ...emptyEntry(), title: 'Bank', password: 'geheim 🔑' };
		const sealed = await seal(key, entry);
		expect(sealed.data).not.toContain('geheim');
		expect(await unseal(await deriveKey('richtig-richtig', salt, ROUNDS), sealed)).toEqual(entry);
	});

	it('erkennt ein falsches Master-Passwort', async () => {
		const salt = newSalt();
		const check = await makeCheck(await deriveKey('richtig-richtig', salt, ROUNDS));
		expect(await verify(await deriveKey('richtig-richtig', salt, ROUNDS), check)).toBe(true);
		expect(await verify(await deriveKey('falsch-falsch', salt, ROUNDS), check)).toBe(false);
	});

	it('lehnt veränderte Daten ab', async () => {
		const key = await deriveKey('richtig-richtig', newSalt(), ROUNDS);
		const sealed = await seal(key, { a: 1 });
		const bytes = Uint8Array.from(atob(sealed.data), (c) => c.charCodeAt(0));
		bytes[0] ^= 1;
		await expect(unseal(key, { iv: sealed.iv, data: btoa(String.fromCharCode(...bytes)) })).rejects.toThrow();
	});

	it('verwendet für jeden Eintrag einen neuen IV', async () => {
		const key = await deriveKey('richtig-richtig', newSalt(), ROUNDS);
		const [a, b] = await Promise.all([seal(key, 'x'), seal(key, 'x')]);
		expect(a.iv).not.toBe(b.iv);
		expect(a.data).not.toBe(b.data);
	});
});

describe('Einträge', () => {
	it('ergänzt fehlende Felder', () => {
		expect(normalize({ title: 'A' })).toEqual({ ...emptyEntry(), title: 'A' });
	});

	it('räumt vor dem Speichern auf', () => {
		const e = tidy({ ...emptyEntry(), title: ' Shop ', urls: ['shop.at', '', ' https://a.at '], fields: [{ label: '', value: '', secret: false }, { label: 'PIN', value: '1234', secret: true }] });
		expect(e.title).toBe('Shop');
		expect(e.urls).toEqual(['https://shop.at', 'https://a.at']);
		expect(e.fields).toEqual([{ label: 'PIN', value: '1234', secret: true }]);
	});

	it('macht nur http(s) zu Links', () => {
		expect(linkHref('https://a.at')).toBe('https://a.at');
		expect(linkHref('javascript:alert(1)')).toBeNull();
	});
});

describe('Generator', () => {
	it('hält Länge und gewählte Zeichen ein', () => {
		for (let i = 0; i < 50; i++) {
			const pw = generatePassword({ length: 24, lower: true, upper: true, digits: true, symbols: true });
			expect(pw).toHaveLength(24);
			expect(pw).toMatch(/[a-z]/);
			expect(pw).toMatch(/[A-Z]/);
			expect(pw).toMatch(/\d/);
			expect(pw).toMatch(/[^a-zA-Z\d]/);
		}
		expect(generatePassword({ length: 16, lower: false, upper: false, digits: true, symbols: false })).toMatch(/^[2-9]{16}$/);
	});

	it('nimmt Kleinbuchstaben, wenn nichts gewählt ist', () => {
		expect(generatePassword({ length: 10, lower: false, upper: false, digits: false, symbols: false })).toMatch(/^[a-z]{10}$/);
	});
});

describe('Stärke', () => {
	it('stuft grob ein', () => {
		expect(strength('').level).toBe(0);
		expect(strength('passwort').level).toBe(0);
		expect(strength('aaaaaaaaaaaaaaaaaaaa').level).toBe(0);
		expect(strength(generatePassword({ length: 20, lower: true, upper: true, digits: true, symbols: true })).level).toBe(3);
	});
});
