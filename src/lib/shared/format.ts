/** Formatierung für Österreich – Beträge in Cent, Zeiten in Wiener Zeit */

export const TZ = 'Europe/Vienna';

const eur = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const eurShort = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 });

export const money = (cents: number | null | undefined) => eur.format((cents ?? 0) / 100);
export const moneyShort = (cents: number | null | undefined) => eurShort.format(Math.round((cents ?? 0) / 100));
export const number = (n: number) => num.format(n);

/** „1.690,50“, „1690.5“, „€ 1.690“ → Cent; null bei Unsinn */
export function parseMoney(input: string | null | undefined): number | null {
	if (input == null) return null;
	let s = String(input).replace(/[€\s]/g, '');
	if (!s) return null;
	if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
	else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
	const n = Number(s);
	return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Cent → „1690,50“ für Eingabefelder */
export const moneyInput = (cents: number | null | undefined) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

export function parseNumber(input: string | null | undefined): number | null {
	if (input == null || String(input).trim() === '') return null;
	const n = Number(String(input).replace(/\s/g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}

const dateFmt = new Intl.DateTimeFormat('de-AT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const dateLong = new Intl.DateTimeFormat('de-AT', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'long' });
const dateTimeFmt = new Intl.DateTimeFormat('de-AT', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('de-AT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('de-AT', { timeZone: 'UTC', month: 'long', year: 'numeric' });

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** „YYYY-MM-DD“ oder ISO-Zeitpunkt → „13.10.2026“ */
export function date(v: string | null | undefined): string {
	if (!v) return '–';
	if (isDay(v)) {
		const [y, m, d] = v.split('-');
		return `${d}.${m}.${y}`;
	}
	return dateFmt.format(new Date(v));
}

export const dateShort = (v: string) => dateLong.format(isDay(v) ? new Date(`${v}T12:00:00Z`) : new Date(v));
export const dateTime = (v: string | null | undefined) => (v ? dateTimeFmt.format(new Date(v)) : '–');
export const time = (v: string) => timeFmt.format(new Date(v));
/** „2026-10“ → „Oktober 2026“ */
export const monthLabel = (ym: string) => monthFmt.format(new Date(`${ym}-01T00:00:00Z`));

/** Heutiges Datum in Wien als „YYYY-MM-DD“ */
export const today = (at = new Date()) => isoDay.format(at);
export const dayOf = (iso: string) => isoDay.format(new Date(iso));

export function addDays(day: string, n: number): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** Monate addieren, Monatsende bleibt Monatsende (31.01. + 1 → 28./29.02.) */
export function addMonths(day: string, n: number): string {
	const [y, m, d] = day.split('-').map(Number);
	const target = new Date(Date.UTC(y, m - 1 + n, 1));
	const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
	target.setUTCDate(Math.min(d, last));
	return target.toISOString().slice(0, 10);
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** „vor 5 Min.“, „gestern“, „in 3 Tagen“ */
export function relative(v: string | null | undefined, now = Date.now()): string {
	if (!v) return '–';
	if (isDay(v)) {
		const d = daysBetween(today(new Date(now)), v);
		if (d === 0) return 'heute';
		if (d === 1) return 'morgen';
		if (d === -1) return 'gestern';
		if (Math.abs(d) < 30) return d > 0 ? `in ${d} Tagen` : `vor ${-d} Tagen`;
		return date(v);
	}
	const diff = Date.parse(v) - now;
	const min = Math.round(Math.abs(diff) / 60_000);
	const future = diff > 0;
	if (min < 1) return 'gerade eben';
	if (min < 60) return future ? `in ${min} Min.` : `vor ${min} Min.`;
	const h = Math.round(min / 60);
	if (h < 24) return future ? `in ${h} Std.` : `vor ${h} Std.`;
	const d = Math.round(h / 24);
	if (d === 1) return future ? 'morgen' : 'gestern';
	if (d < 30) return future ? `in ${d} Tagen` : `vor ${d} Tagen`;
	return date(v);
}

/** Minuten → „2:05 h“ */
export function duration(minutes: number): string {
	const m = Math.max(0, Math.round(minutes));
	return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`;
}

export const hours = (minutes: number) => num.format(Math.round((minutes / 60) * 100) / 100);

export function bytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 ** 2) return `${num.format(Math.round(n / 102.4) / 10)} KB`;
	return `${num.format(Math.round((n / 1024 ** 2) * 10) / 10)} MB`;
}

export const initials = (name: string) =>
	name
		.split(/[\s-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join('');
