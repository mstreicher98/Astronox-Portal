import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject } from 'mailparser';
import { eq, inArray } from 'drizzle-orm';
import { logActivity, notify } from './activity';
import { customerByEmail } from './customers';
import { db, FILES_DIR } from './db';
import { files, mailMessages } from './db/schema';
import { decrypt } from './secret';
import { getSetting, setSetting } from './settings';

/**
 * Liest das Postfach office@astronox.dev über IMAP mit. Mails von bekannten
 * Kunden landen in deren Verlauf, alles andere im Posteingang „nicht zugeordnet“.
 * Im Postfach selbst wird nichts verändert oder gelöscht.
 */

async function connect(): Promise<ImapFlow | null> {
	const s = await getSetting('imap');
	if (!s.enabled || !s.host || !s.user) return null;
	const c = new ImapFlow({
		host: s.host,
		port: s.port,
		secure: s.secure,
		auth: { user: s.user, pass: decrypt(s.password) },
		logger: false,
		connectionTimeout: 20_000,
		greetingTimeout: 15_000,
		socketTimeout: 60_000
	});
	await c.connect();
	return c;
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

			const batch: { uid: number; source: Buffer }[] = [];
			if (!Array.isArray(range) || range.length) {
				for await (const msg of c.fetch(range, { uid: true, source: true }, { uid: true })) {
					if (msg.uid > state.lastUid && msg.source) batch.push({ uid: msg.uid, source: msg.source });
					if (batch.length >= 200) break;
				}
			}
			batch.sort((a, b) => a.uid - b.uid);

			for (const { uid, source } of batch) {
				await store(source, uid, s.mailbox || 'INBOX', own);
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
		const msg = (err as Error).message;
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

async function store(source: Buffer, uid: number, mailbox: string, own: Set<string>) {
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
		return { ok: false, error: (err as Error).message };
	}
}
