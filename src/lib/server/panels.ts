import type { RequestEvent } from '@sveltejs/kit';
import { and, desc, eq, or, type SQL } from 'drizzle-orm';
import { today } from '$lib/shared/format';
import { INTERVALS, type IntervalId } from '$lib/shared/stages';
import { logActivity } from './activity';
import { db } from './db';
import { activities, contracts, credentials, domains, files, mailMessages, monitors, projects } from './db/schema';
import { act, bad, type Fields } from './forms';
import { encrypt } from './secret';
import { deleteFile, saveFile } from './uploads';

/**
 * Bausteine, die Kunden- und Projektseite gemeinsam haben: Notizen, Dateien,
 * Zugänge und Hosting. `owner` ist entweder der Kunde oder das Projekt (mit Kunde).
 */

export interface Owner {
	customerId: number;
	projectId: number | null;
}

/** Bedingung „gehört zu“: beim Kunden alles des Kunden, beim Projekt nur das Projekt */
function belongs<T extends { customerId: unknown; projectId: unknown }>(table: T, o: Owner): SQL {
	const t = table as unknown as { customerId: Parameters<typeof eq>[0]; projectId: Parameters<typeof eq>[0] };
	return o.projectId ? eq(t.projectId, o.projectId) : eq(t.customerId, o.customerId);
}

export async function loadPanels(o: Owner) {
	const [fileRows, credRows, contractRows, domainRows, monitorRows, timeline, mails] = await Promise.all([
		db.select().from(files).where(belongs(files, o)).orderBy(desc(files.createdAt)),
		db
			.select({ id: credentials.id, label: credentials.label, url: credentials.url, username: credentials.username, hasSecret: credentials.secret, hasNotes: credentials.notes, projectId: credentials.projectId, updatedAt: credentials.updatedAt })
			.from(credentials)
			.where(belongs(credentials, o))
			.orderBy(credentials.label),
		db.select().from(contracts).where(belongs(contracts, o)).orderBy(desc(contracts.active), contracts.title),
		db.select().from(domains).where(belongs(domains, o)).orderBy(domains.name),
		db.select().from(monitors).where(belongs(monitors, o)).orderBy(monitors.name),
		db
			.select({ a: activities, project: projects.title })
			.from(activities)
			.leftJoin(projects, eq(projects.id, activities.projectId))
			.where(o.projectId ? eq(activities.projectId, o.projectId) : eq(activities.customerId, o.customerId))
			.orderBy(desc(activities.createdAt))
			.limit(150),
		db
			.select({ id: mailMessages.id, direction: mailMessages.direction, subject: mailMessages.subject, fromAddr: mailMessages.fromAddr, fromName: mailMessages.fromName, toAddrs: mailMessages.toAddrs, date: mailMessages.date, seen: mailMessages.seen, status: mailMessages.status, attachments: mailMessages.attachments })
			.from(mailMessages)
			.where(o.projectId ? eq(mailMessages.projectId, o.projectId) : eq(mailMessages.customerId, o.customerId))
			.orderBy(desc(mailMessages.date))
			.limit(100)
	]);
	return {
		files: fileRows,
		credentials: credRows.map((c) => ({ ...c, hasSecret: !!c.hasSecret, hasNotes: !!c.hasNotes })),
		contracts: contractRows,
		domains: domainRows,
		monitors: monitorRows,
		timeline: timeline.map((r) => ({ ...r.a, project: r.project })),
		mails
	};
}

/* ------------------------------------------------------------------ Aktionen */

export async function addNote(o: Owner, f: Fields) {
	const body = f.req('body', 'einen Text', 20_000);
	const kind = f.oneOf('kind', ['notiz', 'anruf'] as const, 'notiz');
	await logActivity({ ...o, kind, title: kind === 'anruf' ? `Telefonat${f.str('title', 200) ? `: ${f.str('title', 200)}` : ''}` : (f.str('title', 200) ?? 'Notiz'), body });
	return { message: kind === 'anruf' ? 'Telefonat notiert' : 'Notiz gespeichert' };
}

export async function deleteNote(o: Owner, f: Fields) {
	const id = f.id('id') ?? bad('Eintrag fehlt');
	// nur eigene Notizen löschen, keine automatischen Einträge
	await db.delete(activities).where(and(eq(activities.id, id), or(eq(activities.kind, 'notiz'), eq(activities.kind, 'anruf')), o.projectId ? eq(activities.projectId, o.projectId) : eq(activities.customerId, o.customerId)));
	return { message: 'Gelöscht' };
}

export async function uploadFiles(o: Owner, f: Fields) {
	const list = f.files('files');
	if (!list.length) bad('Bitte eine Datei auswählen.');
	for (const file of list) await saveFile(file, o);
	await logActivity({ ...o, kind: 'datei', title: list.length === 1 ? `Datei hochgeladen: ${list[0].name}` : `${list.length} Dateien hochgeladen` });
	return { message: list.length === 1 ? 'Datei hochgeladen' : `${list.length} Dateien hochgeladen` };
}

export async function removeFile(o: Owner, f: Fields) {
	const id = f.id('id') ?? bad('Datei fehlt');
	const [row] = await db.select().from(files).where(and(eq(files.id, id), belongs(files, o)));
	if (!row) bad('Datei nicht gefunden');
	await deleteFile(id);
	return { message: 'Datei gelöscht' };
}

export async function saveCredential(o: Owner, f: Fields) {
	const id = f.id('id');
	const label = f.req('label', 'eine Bezeichnung', 200);
	const secret = f.str('secret', 2000);
	const notes = f.str('notes', 5000);
	const values = { label, url: f.str('url', 500), username: f.str('username', 300), updatedAt: new Date().toISOString() };
	if (id) {
		await db
			.update(credentials)
			.set({
				...values,
				// leeres Passwortfeld beim Bearbeiten = unverändert lassen
				...(secret != null ? { secret: encrypt(secret) } : {}),
				...(notes != null ? { notes: encrypt(notes) } : {})
			})
			.where(and(eq(credentials.id, id), belongs(credentials, o)));
		return { message: 'Zugang gespeichert' };
	}
	await db.insert(credentials).values({ ...values, ...o, secret: secret ? encrypt(secret) : null, notes: notes ? encrypt(notes) : null });
	return { message: 'Zugang angelegt' };
}

export async function removeCredential(o: Owner, f: Fields) {
	const id = f.id('id') ?? bad('Zugang fehlt');
	await db.delete(credentials).where(and(eq(credentials.id, id), belongs(credentials, o)));
	return { message: 'Zugang gelöscht' };
}

export async function saveContract(o: Owner, f: Fields) {
	const id = f.id('id');
	const startDate = f.day('startDate') ?? today();
	const interval = f.oneOf<IntervalId>('interval', INTERVALS.map((i) => i.id), 'monat');
	const values = {
		title: f.req('title', 'eine Bezeichnung', 200),
		description: f.str('description', 2000),
		amountCents: f.money('amount') ?? bad('Bitte den Betrag angeben.'),
		interval,
		startDate,
		endDate: f.day('endDate'),
		nextInvoiceDate: f.day('nextInvoiceDate') ?? startDate,
		autoInvoice: f.bool('autoInvoice'),
		active: f.has('active') ? f.bool('active') : true,
		updatedAt: new Date().toISOString()
	};
	if (id) {
		await db.update(contracts).set(values).where(and(eq(contracts.id, id), belongs(contracts, o)));
		return { message: 'Vertrag gespeichert' };
	}
	await db.insert(contracts).values({ ...values, ...o });
	await logActivity({ ...o, kind: 'system', title: `Wartungsvertrag angelegt: ${values.title}` });
	return { message: 'Vertrag angelegt' };
}

export async function removeContract(o: Owner, f: Fields) {
	const id = f.id('id') ?? bad('Vertrag fehlt');
	await db.update(contracts).set({ active: false, endDate: today() }).where(and(eq(contracts.id, id), belongs(contracts, o)));
	return { message: 'Vertrag beendet' };
}

export async function saveDomain(o: Owner, f: Fields) {
	const id = f.id('id');
	const name = (f.req('name', 'die Domain', 200).replace(/^https?:\/\//, '').split('/')[0] ?? '').toLowerCase();
	const values = { name, registrar: f.str('registrar', 200), expiresOn: f.day('expiresOn'), autoRenew: f.bool('autoRenew'), notes: f.str('notes', 2000) };
	if (id) await db.update(domains).set(values).where(and(eq(domains.id, id), belongs(domains, o)));
	else await db.insert(domains).values({ ...values, ...o });
	return { message: 'Domain gespeichert' };
}

export async function removeDomain(o: Owner, f: Fields) {
	const id = f.id('id') ?? bad('Domain fehlt');
	await db.delete(domains).where(and(eq(domains.id, id), belongs(domains, o)));
	return { message: 'Domain entfernt' };
}

export async function saveMonitor(o: Owner, f: Fields) {
	const id = f.id('id');
	const url = f.url('url') ?? bad('Bitte die Adresse angeben.');
	const values = {
		name: f.str('name', 200) ?? new URL(url).hostname,
		url,
		keyword: f.str('keyword', 200),
		intervalMin: Math.min(60, Math.max(1, f.int('intervalMin') ?? 5)),
		enabled: f.has('enabled') ? f.bool('enabled') : true
	};
	if (id) await db.update(monitors).set(values).where(and(eq(monitors.id, id), belongs(monitors, o)));
	else await db.insert(monitors).values({ ...values, ...o });
	return { message: 'Überwachung gespeichert' };
}

export async function removeMonitor(o: Owner, f: Fields) {
	const id = f.id('id') ?? bad('Überwachung fehlt');
	await db.delete(monitors).where(and(eq(monitors.id, id), belongs(monitors, o)));
	return { message: 'Überwachung entfernt' };
}

/** Alle Panel-Aktionen für eine Seite – `owner` liefert Kunde/Projekt aus den Routenparametern */
export function panelActions(owner: (params: Record<string, string>) => Promise<Owner>) {
	const wrap = (fn: (o: Owner, f: Fields) => Promise<{ message: string }>) => act(async (event: RequestEvent, f) => fn(await owner(event.params as Record<string, string>), f));
	return {
		notiz: wrap(addNote),
		notiz_loeschen: wrap(deleteNote),
		dateien: wrap(uploadFiles),
		datei_loeschen: wrap(removeFile),
		zugang: wrap(saveCredential),
		zugang_loeschen: wrap(removeCredential),
		vertrag: wrap(saveContract),
		vertrag_beenden: wrap(removeContract),
		domain: wrap(saveDomain),
		domain_loeschen: wrap(removeDomain),
		monitor: wrap(saveMonitor),
		monitor_loeschen: wrap(removeMonitor)
	};
}

