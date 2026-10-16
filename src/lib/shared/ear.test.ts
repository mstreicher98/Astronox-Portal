import { describe, expect, it } from 'vitest';
import { afaSchedule, categoryOf, split } from './ear';

describe('split', () => {
	it('teilt brutto in netto und USt', () => {
		expect(split(12000, 20, true)).toEqual({ net: 10000, tax: 2000 });
		expect(split(11300, 13, true)).toEqual({ net: 10000, tax: 1300 });
	});

	it('zählt als Kleinunternehmer den vollen Bruttobetrag', () => {
		expect(split(12000, 20, false)).toEqual({ net: 12000, tax: 0 });
	});
});

describe('afaSchedule', () => {
	it('Inbetriebnahme im 1. Halbjahr: volle Jahres-AfA', () => {
		const s = afaSchedule({ costCents: 180000, startDate: '2026-03-10', years: 3 });
		expect(s.map((y) => [y.year, y.cents])).toEqual([
			[2026, 60000],
			[2027, 60000],
			[2028, 60000]
		]);
		expect(s.at(-1)!.remaining).toBe(0);
	});

	it('Inbetriebnahme im 2. Halbjahr: halbe AfA im ersten Jahr, Rest am Ende', () => {
		const s = afaSchedule({ costCents: 180000, startDate: '2026-10-01', years: 3 });
		expect(s.map((y) => [y.year, y.cents])).toEqual([
			[2026, 30000],
			[2027, 60000],
			[2028, 60000],
			[2029, 30000]
		]);
	});

	it('rundet auf Cent genau bis null', () => {
		const s = afaSchedule({ costCents: 100001, startDate: '2026-01-01', years: 3 });
		expect(s.reduce((n, y) => n + y.cents, 0)).toBe(100001);
		expect(s.at(-1)!.remaining).toBe(0);
	});

	it('Ausscheiden: halbe AfA im 1. Halbjahr, Restbuchwert als Aufwand', () => {
		const s = afaSchedule({ costCents: 180000, startDate: '2025-02-01', years: 3, disposedOn: '2026-04-15' });
		expect(s.map((y) => [y.year, y.cents, y.disposal])).toEqual([
			[2025, 60000, 0],
			[2026, 30000, 90000]
		]);
	});
});

describe('categoryOf', () => {
	it('liefert Kennzahlen', () => {
		expect(categoryOf('erloese').kz).toBe('9040');
		expect(categoryOf('afa').kz).toBe('9130');
		expect(categoryOf('gibtsnicht').id).toBe('sonstiges');
	});
});
