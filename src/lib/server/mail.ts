import { randomUUID } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { logActivity } from './activity';
import { db } from './db';
import { mailMessages } from './db/schema';
import { decrypt } from './secret';
import { getSetting } from './settings';

/**
 * E-Mails aus dem Portal über denselben SMTP-Zugang wie die Webseite
 * (Einstellungen → E-Mail). Jede Mail landet im Verlauf beim Kunden und –
 * wenn IMAP eingerichtet ist – im Ordner „Gesendet“ des Postfachs.
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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Gleiches schlichtes Layout wie die Mails der Webseite */
export function mailHtml(text: string): string {
	const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#3b4bd8">$1</a>');
	const body = text
		.trim()
		.split(/\n{2,}/)
		.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${linkify(esc(p)).replace(/\n/g, '<br>')}</p>`)
		.join('');
	return `<!doctype html><html lang="de"><body style="margin:0;background:#eef0f6;font-family:Helvetica,Arial,sans-serif;color:#141a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0c1430;padding:22px 28px;color:#f3eee2;font-size:15px;letter-spacing:.18em;font-weight:bold">ASTRONOX <span style="color:#f472b6">&#10022;</span></td></tr>
<tr><td style="padding:28px 28px 12px">${body}</td></tr>
<tr><td style="padding:16px 28px 28px;color:#5d6485;font-size:13px;line-height:1.5">Astronox Development · Matthias Streicher<br><a href="mailto:office@astronox.dev" style="color:#5d6485">office@astronox.dev</a> · <a href="https://astronox.dev" style="color:#5d6485">astronox.dev</a></td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(m: OutgoingMail): Promise<{ ok: boolean; id: number; error?: string }> {
	const tp = await transporter();
	const smtp = await getSetting('smtp');
	const messageId = `<${randomUUID()}@astronox.dev>`;
	const now = new Date();
	const options = {
		from: tp?.from ?? smtp.from,
		to: m.to,
		cc: m.cc || undefined,
		subject: m.subject,
		text: m.text,
		html: mailHtml(m.text),
		messageId,
		date: now,
		inReplyTo: m.inReplyTo || undefined,
		references: m.references || m.inReplyTo || undefined,
		attachments: m.attachments
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
