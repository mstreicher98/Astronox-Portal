import { fail, type ActionFailure, type RequestEvent } from '@sveltejs/kit';
import { parseMoney, parseNumber } from '$lib/shared/format';

/**
 * Hilfen für Formular-Aktionen. Mit `act` geschriebene Aktionen dürfen
 * `bad('…')` werfen; daraus wird eine Fehlermeldung, die als Hinweis erscheint.
 */

export class FormError extends Error {}

export const bad = (message: string): never => {
	throw new FormError(message);
};

export function act<E extends RequestEvent, R extends Record<string, unknown> | void>(fn: (event: E, f: Fields) => Promise<R>) {
	return async (event: E): Promise<R | ActionFailure<{ message: string }>> => {
		try {
			const fd = await event.request.formData();
			return await fn(event, fields(fd));
		} catch (err) {
			if (err instanceof FormError) return fail(400, { message: err.message });
			throw err;
		}
	};
}

export type Fields = ReturnType<typeof fields>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function fields(fd: FormData) {
	const raw = (name: string) => {
		const v = fd.get(name);
		return typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '';
	};
	return {
		fd,
		has: (name: string) => fd.has(name),
		/** Text oder null */
		str(name: string, max = 500): string | null {
			const v = raw(name);
			return v ? v.slice(0, max) : null;
		},
		/** Pflichtfeld */
		req(name: string, label: string, max = 500): string {
			const v = raw(name);
			if (!v) bad(`Bitte ${label} angeben.`);
			return v.slice(0, max);
		},
		int(name: string): number | null {
			const n = parseNumber(raw(name));
			return n == null ? null : Math.round(n);
		},
		num(name: string): number | null {
			return parseNumber(raw(name));
		},
		id(name: string): number | null {
			const n = Number(raw(name));
			return Number.isInteger(n) && n > 0 ? n : null;
		},
		money(name: string): number | null {
			const v = raw(name);
			if (!v) return null;
			const c = parseMoney(v);
			if (c == null) bad(`„${v}“ ist kein gültiger Betrag.`);
			return c;
		},
		day(name: string): string | null {
			const v = raw(name);
			if (!v) return null;
			if (!DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) bad(`„${v}“ ist kein gültiges Datum.`);
			return v;
		},
		bool: (name: string) => ['on', 'true', '1', 'ja'].includes(raw(name)),
		email(name: string): string | null {
			const v = raw(name).toLowerCase();
			if (!v) return null;
			if (v.length > 200 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v)) bad(`„${v}“ ist keine gültige E-Mail-Adresse.`);
			return v;
		},
		url(name: string): string | null {
			let v = raw(name);
			if (!v) return null;
			if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
			try {
				return new URL(v).toString().replace(/\/$/, '');
			} catch {
				return bad(`„${v}“ ist keine gültige Adresse.`);
			}
		},
		oneOf<T extends string>(name: string, list: readonly T[], fallback: T): T {
			const v = raw(name) as T;
			return list.includes(v) ? v : fallback;
		},
		all: (name: string) => fd.getAll(name).filter((v): v is string => typeof v === 'string'),
		file(name: string): File | null {
			const v = fd.get(name);
			return v instanceof File && v.size > 0 ? v : null;
		},
		files: (name: string) => fd.getAll(name).filter((v): v is File => v instanceof File && v.size > 0)
	};
}
