import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { mailMessages } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { deleteMails, queueSeen, syncInbox } from '$lib/server/imap';
import type { Actions } from './$types';

/** Aktionen der Liste – Ordner und Mails lädt +layout.server.ts */
export const actions: Actions = {
	abrufen: act(async () => {
		const r = await syncInbox();
		if (r.error) return { message: `Abruf fehlgeschlagen: ${r.error}` };
		return { message: r.fetched ? `${r.fetched} neue Mail${r.fetched === 1 ? '' : 's'}` : 'Keine neuen Mails' };
	}),

	alle_gelesen: act(async () => {
		const rows = await db
			.update(mailMessages)
			.set({ seen: true })
			.where(eq(mailMessages.seen, false))
			.returning({ imapMailbox: mailMessages.imapMailbox, imapUid: mailMessages.imapUid });
		queueSeen(rows, true);
		return { message: 'Alles als gelesen markiert' };
	}),

	gelesen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Mail fehlt.');
		const seen = f.bool('seen');
		const rows = await db.update(mailMessages).set({ seen }).where(eq(mailMessages.id, id)).returning({ imapMailbox: mailMessages.imapMailbox, imapUid: mailMessages.imapUid });
		queueSeen(rows, seen);
	}),

	loeschen: act(async (_e, f) => {
		const id = f.id('id') ?? bad('Mail fehlt.');
		const r = await deleteMails([id]);
		return { message: r.mailboxError ? `Im Portal gelöscht, im Postfach aber nicht: ${r.mailboxError}` : 'Gelöscht' };
	})
};
