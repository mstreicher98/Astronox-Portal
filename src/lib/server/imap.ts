import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { logActivity, notify } from './activity';
import { customerByEmail } from './customers';
import { db, FILES_DIR } from './db';
import { activities, files, mailMessages, notifications } from './db/schema';
import { microsoftHint, microsoftToken } from './microsoft';
import { decrypt } from './secret';
import { getSetting, setSetting } from './settings';

/**
 * Liest das Postfach office@astronox.dev über IMAP mit (Passwort oder Microsoft 365). Mails von bekannten
 * Kunden landen in deren Verlauf, alles andere im Posteingang „nicht zugeordnet“.
 * Gelesen/ungelesen und Löschen übernimmt das Portal ins Postfach (z. B. für
 * Outlook) – gelöschte Mails landen dort im Papierkorb und lassen sich wiederherstellen.
 */

async function connect(): Promise<ImapFlow | null> {
	const s = await getSetting('imap');
	const ms = s.auth === 'microsoft';
	// Microsoft 365 ohne eigenes Postfach: das des Absenders
	const user = s.user || (ms ? (await getSetting('smtp')).from : '');
	if (!s.enabled || !s.host || !user) return null;
	const c = new ImapFlow({
		host: s.host,
		port: s.port,
		secure: s.secure,
		auth: ms ? { user, accessToken: await microsoftToken(await getSetting('microsoft')) } : { user, pass: decrypt(s.password) },
		logger: false,
		connectionTimeout: 20_000,
		greetingTimeout: 15_000,
		socketTimeout: 60_000
	});
	await c.connect();
	return c;
}

/** Bei abgelehnter Anmeldung steht der Grund in responseText, nicht in message */
async function errorText(err: unknown): Promise<string> {
	const e = err as Error & { responseText?: string };
	const msg = e.responseText || e.message;
	return (await getSetting('imap')).auth === 'microsoft' ? microsoftHint(msg) : msg;
}

const first = (a: AddressObject | AddressObject[] | undefined) => (Array.isArray(a) ? a[0] : a)?.value?.[0];
const list = (a: AddressObject | AddressObject[] | undefined) =>
	(Array.isArray(a) ? a : a ? [a] : [])
		.flatMap((x) => x.value)
		.map((v) => v.address)
		.filter(Boolean)
		.join(', ');

const safeName = (name: string) => name.replace(/[^\w.\- äöüÄÖÜß]/g, '_').slice(0, 120) || 'anhang';

let running = false;

export async function syncInbox(): Promise<{ fetched: number; error?: string }> {
	if (running) return { fetched: 0 };
	running = true;
	let c: ImapFlow | null = null;
	const state = await getSetting('imapStand');
	try {
		c = await connect();
		if (!c) return { fetched: 0 };
		const s = await getSetting('imap');
		const smtp = await getSetting('smtp');
		const own = new Set([smtp.from.toLowerCase(), s.user.toLowerCase()]);
		const lock = await c.getMailboxLock(s.mailbox || 'INBOX');
		let fetched = 0;
		try {
			const box = c.mailbox;
			if (!box) throw new Error('Postfach nicht gefunden');
			const validity = String(box.uidValidity);
			let range: string | number[];
			if (state.mailbox !== s.mailbox || state.uidValidity !== validity) {
				// Erster Abruf: nur die letzten 14 Tage
				const since = new Date(Date.now() - 14 * 86_400_000);
				const found = await c.search({ since }, { uid: true });
				range = found || [];
				state.lastUid = 0;
			} else {
				range = `${state.lastUid + 1}:*`;
			}
			if (Array.isArray(range) && !range.length) range = [];

			const batch: { uid: number; source: Buffer; seen: boolean }[] = [];
			if (!Array.isArray(range) || range.length) {
				for await (const msg of c.fetch(range, { uid: true, source: true, flags: true }, { uid: true })) {
					if (msg.uid > state.lastUid && msg.source) batch.push({ uid: msg.uid, source: msg.source, seen: !!msg.flags?.has('\\Seen') });
					if (batch.length >= 200) break;
				}
			}
			batch.sort((a, b) => a.uid - b.uid);

			for (const { uid, source, seen } of batch) {
				await store(source, uid, s.mailbox || 'INBOX', own, seen);
				state.lastUid = Math.max(state.lastUid, uid);
				fetched++;
			}
			state.mailbox = s.mailbox;
			state.uidValidity = validity;
		} finally {
			lock.release();
		}
		state.lastSync = new Date().toISOString();
		state.lastError = '';
		await setSetting('imapStand', state);
		return { fetched };
	} catch (err) {
		const msg = await errorText(err);
		console.error('[imap]', msg);
		state.lastError = msg;
		state.lastSync = new Date().toISOString();
		await setSetting('imapStand', state);
		return { fetched: 0, error: msg };
	} finally {
		running = false;
		await c?.logout().catch(() => {});
	}
}

/** seen: im Postfach schon gelesen (z. B. in Outlook) */
async function store(source: Buffer, uid: number, mailbox: string, own: Set<string>, seen: boolean) {
	const mail = await simpleParser(source, { skipImageLinks: true });
	const from = first(mail.from);
	const fromAddr = from?.address?.toLowerCase() ?? '';
	const refs = [mail.inReplyTo, ...(Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : [])].filter((x): x is string => !!x);

	// Zuordnung: Antwort auf eine Mail aus dem Portal, sonst Absenderadresse
	let customerId: number | null = null;
	let projectId: number | null = null;
	if (refs.length) {
		const [parent] = await db
			.select({ customerId: mailMessages.customerId, projectId: mailMessages.projectId })
			.from(mailMessages)
			.where(inArray(mailMessages.messageId, refs))
			.limit(1);
		if (parent) {
			customerId = parent.customerId;
			projectId = parent.projectId;
		}
	}
	customerId ??= await customerByEmail(fromAddr);
	// Benachrichtigungen der Webseite an das eigene Postfach nicht doppelt zeigen
	const ignored = own.has(fromAddr);

	const [row] = await db
		.insert(mailMessages)
		.values({
			direction: 'ein',
			messageId: mail.messageId ?? null,
			inReplyTo: mail.inReplyTo ?? null,
			references: refs.join(' ') || null,
			fromAddr: fromAddr || 'unbekannt',
			fromName: from?.name || null,
			toAddrs: list(mail.to),
			ccAddrs: list(mail.cc) || null,
			subject: (mail.subject || '(ohne Betreff)').slice(0, 500),
			text: mail.text?.slice(0, 200_000) ?? null,
			html: typeof mail.html === 'string' ? mail.html.slice(0, 600_000) : null,
			date: (mail.date ?? new Date()).toISOString(),
			customerId,
			projectId,
			ignored,
			seen,
			imapMailbox: mailbox,
			imapUid: uid
		})
		.onConflictDoNothing()
		.returning({ id: mailMessages.id });
	if (!row) return;

	// Anhänge als Dateien beim Kunden ablegen (ohne eingebettete Bilder aus Signaturen)
	const saved: { fileId: number; name: string; size: number }[] = [];
	for (const a of mail.attachments ?? []) {
		if (a.related || a.size > 20 * 1024 * 1024) continue;
		const name = safeName(a.filename || 'anhang');
		const stored = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${path.extname(name).slice(0, 10)}`;
		await fs.writeFile(path.join(FILES_DIR, stored), a.content);
		const [f] = await db
			.insert(files)
			.values({ customerId, projectId, name, storedName: stored, mime: a.contentType || 'application/octet-stream', size: a.size, source: 'mail', mailId: row.id })
			.returning({ id: files.id });
		saved.push({ fileId: f.id, name, size: a.size });
	}
	if (saved.length) {
		await db.update(mailMessages).set({ attachments: JSON.stringify(saved) }).where(eq(mailMessages.id, row.id));
	}

	if (ignored) return;
	const who = from?.name || fromAddr;
	if (customerId) {
		await logActivity({ customerId, projectId, kind: 'mail_ein', title: `E-Mail erhalten: ${mail.subject || '(ohne Betreff)'}`, meta: { mailId: row.id } });
		await notify({ kind: 'mail', title: `Mail von ${who}`, body: mail.subject || '', url: `/posteingang/${row.id}` });
	} else {
		// Unbekannte Absender: nur Glocke, kein Push (könnte Werbung sein)
		await notify({ kind: 'mail', title: `Mail von ${who}`, body: mail.subject || '', url: `/posteingang/${row.id}`, push: false });
	}
}

/** Kopie einer gesendeten Mail im Ordner „Gesendet“ ablegen */
export async function appendSent(raw: Buffer) {
	const s = await getSetting('imap');
	if (!s.enabled || !s.sentMailbox) return;
	// Microsoft 365 legt über SMTP Gesendetes selbst in „Gesendete Elemente“ ab – sonst doppelt
	if ((await getSetting('smtp')).auth === 'microsoft') return;
	const c = await connect();
	if (!c) return;
	try {
		await c.append(s.sentMailbox, raw, ['\\Seen']);
	} finally {
		await c.logout().catch(() => {});
	}
}

/** Verbindung prüfen und Ordner auflisten (Einstellungen) */
export async function testImap(): Promise<{ ok: true; folders: string[] } | { ok: false; error: string }> {
	try {
		const c = await connect();
		if (!c) return { ok: false, error: 'IMAP ist nicht eingeschaltet oder unvollständig.' };
		try {
			const boxes = await c.list();
			return { ok: true, folders: boxes.map((b) => b.path) };
		} finally {
			await c.logout().catch(() => {});
		}
	} catch (err) {
		return { ok: false, error: await errorText(err) };
	}
}

/* ------------------------------------------------- Änderungen ins Postfach */

type MailRef = { imapMailbox: string | null; imapUid: number | null };

/** UIDs je Ordner – nur Mails, die aus dem Postfach stammen */
function byMailbox(rows: MailRef[]): Map<string, number[]> {
	const out = new Map<string, number[]>();
	for (const r of rows) {
		if (!r.imapMailbox || !r.imapUid) continue;
		out.set(r.imapMailbox, [...(out.get(r.imapMailbox) ?? []), r.imapUid]);
	}
	return out;
}

/** Gelesen bzw. ungelesen auch im Postfach markieren (Outlook, Handy …) */
export async function setSeenInMailbox(rows: MailRef[], seen: boolean): Promise<void> {
	const groups = byMailbox(rows);
	if (!groups.size) return;
	const c = await connect();
	if (!c) return;
	try {
		for (const [box, uids] of groups) {
			const lock = await c.getMailboxLock(box);
			try {
				if (seen) await c.messageFlagsAdd(uids, ['\Seen'], { uid: true });
				else await c.messageFlagsRemove(uids, ['\Seen'], { uid: true });
			} finally {
				lock.release();
			}
		}
	} finally {
		await c.logout().catch(() => {});
	}
}

/** Im Hintergrund – das Öffnen einer Mail wartet nicht auf den Mailserver */
export function queueSeen(rows: MailRef[], seen: boolean) {
	void setSeenInMailbox(rows, seen).catch(async (err) => console.error('[imap] gelesen:', await errorText(err)));
}

const TRASH_NAMES = ['deleted items', 'gelöschte elemente', 'trash', 'papierkorb', 'inbox.trash', 'deleted messages'];

/** In den Papierkorb des Postfachs verschieben (bei Microsoft 365 „Gelöschte Elemente“) */
async function trashInMailbox(rows: MailRef[]): Promise<string | undefined> {
	const groups = byMailbox(rows);
	if (!groups.size) return;
	let c: ImapFlow | null = null;
	try {
		c = await connect();
		if (!c) return;
		const boxes = await c.list();
		const trash = boxes.find((b) => b.specialUse === '\Trash') ?? boxes.find((b) => TRASH_NAMES.includes(b.path.toLowerCase()));
		if (!trash) return 'kein Papierkorb-Ordner im Postfach gefunden';
		for (const [box, uids] of groups) {
			if (box === trash.path) continue;
			const lock = await c.getMailboxLock(box);
			try {
				await c.messageMove(uids, trash.path, { uid: true });
			} finally {
				lock.release();
			}
		}
	} catch (err) {
		return await errorText(err);
	} finally {
		await c?.logout().catch(() => {});
	}
}

/**
 * Mails im Portal löschen. Empfangene wandern im Postfach in den Papierkorb –
 * sonst kämen sie beim nächsten vollständigen Abruf wieder. Anhänge, die bei
 * einem Kunden oder Projekt liegen, bleiben dort; alle anderen gehen mit.
 */
export async function deleteMails(ids: number[]): Promise<{ deleted: number; mailboxError?: string }> {
	if (!ids.length) return { deleted: 0 };
	const rows = await db
		.select({ id: mailMessages.id, direction: mailMessages.direction, imapMailbox: mailMessages.imapMailbox, imapUid: mailMessages.imapUid })
		.from(mailMessages)
		.where(inArray(mailMessages.id, ids));
	if (!rows.length) return { deleted: 0 };
	const mailboxError = await trashInMailbox(rows.filter((r) => r.direction === 'ein'));

	const found = rows.map((r) => r.id);
	for (const f of await db.select().from(files).where(inArray(files.mailId, found))) {
		if (f.customerId || f.projectId) continue;
		await fs.rm(path.join(FILES_DIR, f.storedName), { force: true });
		await db.delete(files).where(eq(files.id, f.id));
	}
	await db.update(files).set({ mailId: null }).where(inArray(files.mailId, found));
	// Verlauf und Glocke würden sonst auf eine gelöschte Mail zeigen
	await db.delete(activities).where(and(inArray(activities.kind, ['mail_ein', 'mail_aus']), inArray(sql`json_extract(${activities.meta}, '$.mailId')`, found)));
	await db.delete(notifications).where(inArray(notifications.url, found.map((id) => `/posteingang/${id}`)));
	await db.delete(mailMessages).where(inArray(mailMessages.id, found));
	return { deleted: found.length, mailboxError };
}
