import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { documents } from '$lib/server/db/schema';
import { documentPdf, pdfName } from '$lib/server/documents';
import { fields } from '$lib/server/forms';
import { sendMail } from '$lib/server/mail';
import { advanceTo } from '$lib/server/projects';
import type { RequestHandler } from './$types';

/** E-Mail aus dem Portal senden (Antworten, Angebote, Rechnungen, freie Mails) */
export const POST: RequestHandler = async ({ request }) => {
	const f = fields(await request.formData());
	const to = f.str('to', 300);
	const subject = f.str('subject', 300);
	const text = f.str('text', 50_000);
	if (!to || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(to)) error(400, 'Bitte eine gültige Empfängeradresse angeben.');
	if (!subject) error(400, 'Bitte einen Betreff angeben.');
	if (!text) error(400, 'Die Nachricht ist leer.');

	const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];
	for (const file of f.files('attachments')) {
		if (file.size > 20 * 1024 * 1024) error(400, `„${file.name}“ ist zu groß für eine E-Mail (max. 20 MB).`);
		attachments.push({ filename: file.name, content: Buffer.from(await file.arrayBuffer()), contentType: file.type || undefined });
	}

	const documentId = f.id('documentId');
	let doc: typeof documents.$inferSelect | undefined;
	if (documentId) {
		[doc] = await db.select().from(documents).where(eq(documents.id, documentId));
		if (!doc) error(400, 'Beleg nicht gefunden');
		if (f.bool('attachDocument')) {
			if (doc.status === 'entwurf') error(400, 'Bitte den Beleg zuerst festschreiben – Entwürfe werden nicht verschickt.');
			attachments.unshift({ filename: pdfName(doc), content: await documentPdf(doc.id), contentType: 'application/pdf' });
		}
	}

	const result = await sendMail({
		to,
		cc: f.str('cc', 300),
		subject,
		text,
		attachments,
		customerId: f.id('customerId') ?? doc?.customerId ?? null,
		projectId: f.id('projectId') ?? doc?.projectId ?? null,
		documentId: documentId ?? null,
		inReplyTo: f.str('inReplyTo', 500),
		references: f.str('references', 2000)
	});
	if (!result.ok) error(502, `Die Mail konnte nicht gesendet werden: ${result.error}`);

	if (doc) {
		await db.update(documents).set({ sentAt: new Date().toISOString() }).where(eq(documents.id, doc.id));
		if (doc.type === 'angebot') await advanceTo(doc.projectId, 'angebot');
	}
	return json({ ok: true, id: result.id });
};
