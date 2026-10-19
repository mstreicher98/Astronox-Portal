import { TZ, addDays, date, dayOf, daysBetween, monthLabel, time, today } from './format';

/**
 * Posteingang wie in Outlook: Gruppen nach Datum (Heute, Gestern, Diese Woche …)
 * und kurze Zeitangaben in der Liste.
 */

const weekday = new Intl.DateTimeFormat('de-AT', { timeZone: TZ, weekday: 'short' });

/** Montag der Woche von „day“ */
const monday = (day: string) => addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

export function dayGroup(iso: string, now = new Date()): string {
	const d = dayOf(iso);
	const t = today(now);
	const diff = daysBetween(d, t);
	if (diff <= 0) return 'Heute';
	if (diff === 1) return 'Gestern';
	const week = monday(t);
	if (d >= week) return 'Diese Woche';
	if (d >= addDays(week, -7)) return 'Letzte Woche';
	return monthLabel(d.slice(0, 7));
}

/** Heute „14:32“, diese Woche „Mo. 14:32“, sonst „12.10.2026“ */
export function listTime(iso: string, now = new Date()): string {
	const d = dayOf(iso);
	const t = today(now);
	if (d >= t) return time(iso);
	if (d >= monday(t) || daysBetween(d, t) === 1) return `${weekday.format(new Date(iso))} ${time(iso)}`;
	return date(iso);
}

/** Mails der Reihe nach in Datumsgruppen (die Liste ist schon nach Datum sortiert) */
export function groupByDay<T extends { date: string }>(mails: T[], now = new Date()): { label: string; mails: T[] }[] {
	const out: { label: string; mails: T[] }[] = [];
	for (const m of mails) {
		const label = dayGroup(m.date, now);
		const last = out.at(-1);
		if (last?.label === label) last.mails.push(m);
		else out.push({ label, mails: [m] });
	}
	return out;
}

/** Gleichbleibende Farbe je Absender für den Kreis mit den Initialen */
const COLORS = ['var(--accent)', 'var(--nebula)', 'var(--pink)', 'var(--violet)', 'var(--peach)', 'var(--sky)'];
export function avatarColor(key: string): string {
	let h = 0;
	for (const ch of key.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return COLORS[h % COLORS.length];
}
