import { describe, expect, it } from 'vitest';
import { avatarColor, dayGroup, groupByDay, listTime } from './inbox';

// Montag, 19. Oktober 2026, 15:00 in Wien
const now = new Date('2026-10-19T13:00:00Z');

describe('dayGroup', () => {
	it('ordnet wie Outlook ein', () => {
		expect(dayGroup('2026-10-19T06:00:00Z', now)).toBe('Heute');
		expect(dayGroup('2026-10-18T20:00:00Z', now)).toBe('Gestern');
		expect(dayGroup('2026-10-14T10:00:00Z', now)).toBe('Letzte Woche');
		expect(dayGroup('2026-10-11T10:00:00Z', now)).toBe('Oktober 2026');
		expect(dayGroup('2026-09-30T10:00:00Z', now)).toBe('September 2026');
	});

	it('kennt „Diese Woche“ ab Mittwoch', () => {
		const thu = new Date('2026-10-22T10:00:00Z');
		expect(dayGroup('2026-10-19T10:00:00Z', thu)).toBe('Diese Woche');
		expect(dayGroup('2026-10-18T10:00:00Z', thu)).toBe('Letzte Woche');
	});

	it('rechnet in Wiener Zeit', () => {
		// Sommerzeit (UTC+2): 22:30 UTC am 18. ist in Wien schon 00:30 am 19.
		expect(dayGroup('2026-10-18T22:30:00Z', now)).toBe('Heute');
		expect(dayGroup('2026-10-18T21:30:00Z', now)).toBe('Gestern');
	});
});

describe('listTime', () => {
	it('zeigt heute nur die Uhrzeit, sonst Wochentag oder Datum', () => {
		expect(listTime('2026-10-19T08:05:00Z', now)).toBe('10:05');
		expect(listTime('2026-10-18T08:05:00Z', now)).toMatch(/^So\.? 10:05$/);
		expect(listTime('2026-10-12T08:05:00Z', now)).toBe('12.10.2026');
	});
});

describe('groupByDay', () => {
	it('fasst aufeinanderfolgende Mails zusammen', () => {
		const g = groupByDay([{ date: '2026-10-19T09:00:00Z' }, { date: '2026-10-19T07:00:00Z' }, { date: '2026-10-18T09:00:00Z' }], now);
		expect(g.map((x) => [x.label, x.mails.length])).toEqual([
			['Heute', 2],
			['Gestern', 1]
		]);
	});
});

describe('avatarColor', () => {
	it('bleibt je Absender gleich', () => {
		expect(avatarColor('a@b.at')).toBe(avatarColor('A@B.at'));
	});
});
