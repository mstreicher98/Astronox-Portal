import { describe, expect, it } from 'vitest';
import { contractStatus, duePeriods, earliestEnd, periodFrom, proratedCents, prorationNote } from './billing';

describe('periodFrom', () => {
	it('rechnet einen vollen Monat ab dem Ersten', () => {
		const p = periodFrom('2026-11-01', 1, null)!;
		expect(p).toMatchObject({ from: '2026-11-01', to: '2026-11-30', factor: 1, next: '2026-12-01' });
	});

	it('rechnet den ersten Monat bei Beginn mitten im Monat anteilig', () => {
		const p = periodFrom('2026-10-15', 1, null)!;
		expect(p).toMatchObject({ from: '2026-10-15', to: '2026-10-31', days: 17, ofDays: 31, partialMonth: true, next: '2026-11-01' });
		expect(proratedCents(1900, p)).toBe(1042);
		expect(prorationNote(p, 1)).toBe('anteilig für 17 von 31 Tagen');
	});

	it('nimmt bei Quartalen für den Rest des Startmonats ein Drittel', () => {
		const p = periodFrom('2026-10-16', 3, null)!;
		expect(p.next).toBe('2026-11-01');
		expect(proratedCents(9000, p)).toBe(1548); // 90 € / 3 × 16/31
		const q = periodFrom(p.next, 3, null)!;
		expect(q).toMatchObject({ from: '2026-11-01', to: '2027-01-31', factor: 1, next: '2027-02-01' });
	});

	it('kürzt den letzten Zeitraum bei Vertragsende', () => {
		const p = periodFrom('2027-02-01', 1, '2027-02-14')!;
		expect(p).toMatchObject({ to: '2027-02-14', days: 14, ofDays: 28 });
		expect(proratedCents(2000, p)).toBe(1000);
		expect(periodFrom('2027-03-01', 1, '2027-02-28')).toBeNull();
	});

	it('kommt mit Schaltjahren und Jahresverträgen zurecht', () => {
		expect(periodFrom('2028-02-01', 1, null)!.to).toBe('2028-02-29');
		expect(periodFrom('2026-01-01', 12, null)).toMatchObject({ to: '2026-12-31', factor: 1, next: '2027-01-01' });
	});
});

describe('duePeriods', () => {
	it('holt versäumte Zeiträume nach, aber nicht die Zukunft', () => {
		const ps = duePeriods('2026-08-20', 1, null, '2026-10-14');
		expect(ps.map((p) => p.from)).toEqual(['2026-08-20', '2026-09-01', '2026-10-01']);
	});

	it('rechnet im Voraus: am Ersten ist der ganze Monat fällig', () => {
		expect(duePeriods('2026-11-01', 1, null, '2026-10-31')).toEqual([]);
		expect(duePeriods('2026-11-01', 1, null, '2026-11-01')).toHaveLength(1);
	});

	it('hört beim Vertragsende auf', () => {
		expect(duePeriods('2026-11-01', 1, '2026-11-30', '2027-03-01')).toHaveLength(1);
	});
});

describe('earliestEnd', () => {
	it('Kündigungsfrist zum Monatsende', () => {
		expect(earliestEnd('2026-01-01', '2026-10-14', 1, null)).toBe('2026-11-30');
		expect(earliestEnd('2026-01-01', '2026-10-14', 3, null)).toBe('2027-01-31');
		expect(earliestEnd('2026-01-01', '2026-10-14', 0, null)).toBe('2026-10-31');
	});

	it('frühestens nach der Mindestlaufzeit', () => {
		expect(earliestEnd('2026-10-15', '2026-11-02', 1, 12)).toBe('2027-10-31');
		expect(earliestEnd('2025-01-01', '2026-10-14', 1, 12)).toBe('2026-11-30');
	});
});

describe('contractStatus', () => {
	const base = { active: true, startDate: '2026-01-01', endDate: null, cancelledOn: null };
	it('unterscheidet aktiv, gekündigt, beendet und geplant', () => {
		expect(contractStatus(base, '2026-10-14')).toBe('aktiv');
		expect(contractStatus({ ...base, cancelledOn: '2026-10-01', endDate: '2026-11-30' }, '2026-10-14')).toBe('gekuendigt');
		expect(contractStatus({ ...base, endDate: '2026-09-30' }, '2026-10-14')).toBe('beendet');
		expect(contractStatus({ ...base, startDate: '2026-11-01' }, '2026-10-14')).toBe('geplant');
		expect(contractStatus({ ...base, active: false }, '2026-10-14')).toBe('pausiert');
	});
});
