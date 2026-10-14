import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { LOGO_CID, mailLayout, mailSettings, paragraphsHtml } from '$lib/shared/mails';
import { logActivity } from './activity';
import { db } from './db';
import { mailMessages } from './db/schema';
import { LOGO_PNG } from './mail-logo';
import { decrypt } from './secret';
import { getSetting } from './settings';

/**
 * E-Mails aus dem Portal über denselben SMTP-Zugang wie die Webseite
 * (Einstellungen → E-Mail). Layout, Logo und Fußzeile wie bei den Mails der
 * Webseite (Einstellungen → E-Mail-Texte). Jede Mail landet im Verlauf beim
 * Kunden und – wenn IMAP eingerichtet ist – im Ordner „Gesendet“ des Postfachs.
 */

export interface OutgoingMail {
	to: string;
	cc?: string | null;
	subject: string;
	/** Text mit Leerzeilen zwischen Absätzen – wird auch als HTML gesetzt */
	text: string;
	attachments?: { filename: string; content: Buffer; contentType?: string }[];
	customerId?: number | null;
	projectId?: number | null;
	documentId?: number | null;
	inReplyTo?: string | null;
	references?: string | null;
}

let transport: { key: string; t: Transporter } | null = null;

export async function smtpReady(): Promise<boolean> {
	const s = await getSetting('smtp');
	return !!s.host;
}

async function transporter() {
	const s = await getSetting('smtp');
	if (!s.host) return null;
	const password = decrypt(s.password);
	const key = JSON.stringify([s.host, s.port, s.secure, s.user, password]);
	if (!transport || transport.key !== key) {
		transport = {
			key,
			t: nodemailer.createTransport({
				host: s.host,
				port: s.port,
				secure: s.secure,
				auth: s.user ? { user: s.user, pass: password } : undefined,
				connectionTimeout: 15_000,
				greetingTimeout: 15_000,
				socketTimeout: 30_000
			})
		};
	}
	const name = s.fromName.replace(/["<>]/g, '');
	return { t: transport.t, from: name ? `"${name}" <${s.from}>` : s.from, address: s.from };
}

/** Prüft die Verbindung zum Mailserver (Einstellungen → „Verbindung testen“) */
export async function verifySmtp(): Promise<string | null> {
	const tp = await transporter();
	if (!tp) return 'Kein SMTP-Server eingetragen.';
	try {
		await tp.t.verify();
		return null;
	} catch (err) {
		return (err as Error).message;
	}
}

/** Alle Mail-Texte samt Fußzeile (Einstellungen → E-Mail-Texte) */
export async function getMailSettings() {
	return mailSettings(await getSetting('mails'));
}

/** Gleiches Layout wie die Mails der Webseite: Logo, Absätze, Fußzeile */
export function mailHtml(text: string, footer: string, logo = `cid:${LOGO_CID}`): string {
	return mailLayout(paragraphsHtml(text), { footer, logo });
}

export async function sendMail(m: OutgoingMail): Promise<{ ok: boolean; id: number; error?: string }> {
	const tp = await transporter();
	const smtp = await getSetting('smtp');
	const { footer } = await getMailSettings();
	const messageId = `<${randomUUID()}@astronox.dev>`;
	const now = new Date();
	const options = {
		from: tp?.from ?? smtp.from,
		to: m.to,
		cc: m.cc || undefined,
		subject: m.subject,
		text: m.text,
		html: mailHtml(m.text, footer),
		messageId,
		date: now,
		inReplyTo: m.inReplyTo || undefined,
		references: m.references || m.inReplyTo || undefined,
		// Logo im Kopf als eingebettetes Bild – wird ohne Nachladen angezeigt
		attachments: [{ filename: 'astronox.png', content: LOGO_PNG, contentType: 'image/png', cid: LOGO_CID, contentDisposition: 'inline' as const }, ...(m.attachments ?? [])]
	};

	let status: 'gesendet' | 'fehler' = 'gesendet';
	let error: string | undefined;
	let raw: Buffer | null = null;
	if (!tp) {
		status = 'fehler';
		error = 'Kein SMTP-Server eingetragen (Einstellungen → E-Mail).';
	} else {
		try {
			raw = await new MailComposer(options).compile().build();
			await tp.t.sendMail({ envelope: { from: tp.address, to: [m.to, ...(m.cc ? [m.cc] : [])] }, raw });
		} catch (err) {
			status = 'fehler';
			error = (err as Error).message;
			console.error('[mail]', error);
		}
	}

	const [row] = await db
		.insert(mailMessages)
		.values({
			direction: 'aus',
			messageId,
			inReplyTo: m.inReplyTo ?? null,
			references: m.references ?? m.inReplyTo ?? null,
			fromAddr: smtp.from,
			fromName: smtp.fromName,
			toAddrs: m.to,
			ccAddrs: m.cc ?? null,
			subject: m.subject,
			text: m.text,
			date: now.toISOString(),
			customerId: m.customerId ?? null,
			projectId: m.projectId ?? null,
			documentId: m.documentId ?? null,
			seen: true,
			attachments: JSON.stringify((m.attachments ?? []).map((a) => ({ name: a.filename, size: a.content.length }))),
			status,
			error: error ?? null
		})
		.returning({ id: mailMessages.id });

	if (status === 'gesendet') {
		await logActivity({ customerId: m.customerId, projectId: m.projectId, kind: 'mail_aus', title: `E-Mail gesendet: ${m.subject}`, meta: { mailId: row.id } });
		if (raw) {
			// Kopie in „Gesendet“ ablegen – Fehler dabei sind nicht schlimm
			import('./imap').then(({ appendSent }) => appendSent(raw!)).catch((err) => console.error('[imap] Gesendet:', err.message));
		}
	}
	return { ok: status === 'gesendet', id: row.id, error };
}

/** Platzhalter wie {{name}} in Vorlagen ersetzen */
export function fillTemplate(text: string, values: Record<string, string | null | undefined>): string {
	return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (all, key: string) => values[key] ?? all);
}

/** „Guten Tag Frau Muster,“ gibt es nicht ohne Anrede-Feld – daher neutral mit Namen */
export const greeting = (name: string | null | undefined) => (name?.trim() ? `Guten Tag ${name.trim()},` : 'Guten Tag,');
