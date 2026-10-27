import { describe, expect, it } from 'vitest';
import { safeTarget } from './target';

describe('Ziel nach dem Anmelden', () => {
	it('behält Pfade im Portal', () => {
		expect(safeTarget('/rechnungen/12?typ=angebot')).toBe('/rechnungen/12?typ=angebot');
		expect(safeTarget('/posteingang#oben')).toBe('/posteingang#oben');
	});

	it('lässt keine fremden Adressen durch', () => {
		for (const t of ['//evil.example', '/\\evil.example', '/\\/evil.example', '/\t/evil.example', '/\n/evil.example', 'https://evil.example', 'javascript:alert(1)', '', null]) {
			expect(safeTarget(t)).toBe('/');
		}
	});
});
