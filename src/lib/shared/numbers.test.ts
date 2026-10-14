import { describe, expect, it } from 'vitest';
import { documentNumber } from './numbers';

describe('documentNumber', () => {
	it('setzt Jahr zweistellig und laufende Nummer ein', () => {
		expect(documentNumber('RE{JJ} {NR}', 2026, 1, 1)).toBe('RE26 1');
		expect(documentNumber('AN{JJ} {NR}', '2027', 12, 1)).toBe('AN27 12');
	});

	it('füllt mit Nullen auf', () => {
		expect(documentNumber('RE{JJ} {NR}', 2026, 1, 4)).toBe('RE26 0001');
		expect(documentNumber('AN{JJ} {NR}', 2026, 12345, 4)).toBe('AN26 12345');
	});

	it('hängt die Nummer an, wenn {NR} fehlt', () => {
		expect(documentNumber('RE-{JJJJ}-', 2026, 1, 3)).toBe('RE-2026-001');
	});
});
