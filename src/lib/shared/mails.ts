/**
 * Layout und Texte der E-Mails.
 *
 * Gleiche Datei in beiden Repositories: Webseite src/lib/mails.ts, Portal
 * src/lib/shared/mails.ts – Änderungen immer in beiden nachziehen.
 * Die Texte pflegt das Portal (Einstellungen → E-Mail-Texte) in der Tabelle
 * „settings“ unter „mails“. Fehlt dort etwas, gelten die Standardtexte unten.
 */

/** Content-ID des Logos – es hängt als eingebettetes Bild an jeder Mail */
export const LOGO_CID = 'logo@astronox.dev';

export interface MailText {
	subject: string;
	/** Überschrift über dem Text, leer = keine */
	heading: string;
	/** Absätze durch Leerzeilen getrennt; {{details}} und {{knopf}} stehen allein in einem Absatz */
	body: string;
	/** Beschriftung des Knopfs ({{knopf}}) */
	button?: string;
}

export const WEB_MAILS = [
	{ key: 'anfrage_kunde', label: 'Projektanfrage – Bestätigung an den Kunden', fields: ['name', 'details'] },
	{ key: 'anfrage_info', label: 'Projektanfrage – Hinweis an dich', fields: ['name', 'projekt', 'details'] },
	{ key: 'termin_kunde', label: 'Terminbuchung – Bestätigung an den Kunden', fields: ['name', 'termin', 'datum', 'art', 'ablauf', 'details', 'knopf'] },
	{ key: 'termin_info', label: 'Terminbuchung – Hinweis an dich', fields: ['name', 'termin', 'details'] },
	{ key: 'absage_kunde', label: 'Terminabsage – an den Kunden', fields: ['name', 'termin', 'knopf'] },
	{ key: 'absage_info', label: 'Terminabsage – Hinweis an dich', fields: ['name', 'email', 'termin'] },
	{ key: 'angebot_kunde', label: 'Angebot angenommen – Bestätigung an den Kunden', fields: ['name', 'nummer', 'titel', 'betrag', 'details', 'knopf'] },
	{ key: 'angebot_info', label: 'Angebot angenommen – Hinweis an dich', fields: ['name', 'nummer', 'titel', 'betrag', 'details'] },
	{ key: 'aenderung_info', label: 'Änderungswunsch zum Angebot – Hinweis an dich', fields: ['name', 'nummer', 'titel', 'betrag', 'details'] }
] as const;

export type WebMailKey = (typeof WEB_MAILS)[number]['key'];

export interface MailSettings {
	/** Fußzeile unter jeder Mail – Adressen und Links werden klickbar */
	footer: string;
	/** Automatische Mails der Webseite */
	web: Record<WebMailKey, MailText>;
	/** Satz für {{ablauf}} in der Terminbestätigung */
	ablauf: { telefon: string; video: string; videoOhneLink: string };
}

const GRUSS = 'Viele Grüße\nMatthias Streicher';

export const MAIL_DEFAULTS: MailSettings = {
	footer: 'Astronox Development · Matthias Streicher\noffice@astronox.dev · astronox.dev',
	web: {
		anfrage_kunde: {
			subject: 'Ihre Projektanfrage bei Astronox Development',
			heading: 'Danke für Ihre Anfrage',
			body: `Guten Tag {{name}},\n\nIhre Anfrage ist bei mir angekommen. Ich sehe sie mir genau an und melde mich innerhalb von zwei Werktagen bei Ihnen.\n\n{{details}}\n\n${GRUSS}`
		},
		anfrage_info: {
			subject: 'Neue Projektanfrage: {{name}} – {{projekt}}',
			heading: 'Neue Projektanfrage',
			body: '{{details}}'
		},
		termin_kunde: {
			subject: 'Ihr Erstgespräch am {{datum}}',
			heading: 'Ihr Termin ist bestätigt',
			body: `Guten Tag {{name}},\n\nvielen Dank für Ihre Buchung. Ich freue mich auf das Gespräch!\n\n{{details}}\n\n{{ablauf}}\n\nIm Anhang finden Sie den Termin für Ihren Kalender. Falls Ihnen etwas dazwischenkommt, können Sie den Termin hier absagen:\n\n{{knopf}}\n\n${GRUSS}`,
			button: 'Termin ansehen oder absagen'
		},
		termin_info: {
			subject: 'Neuer Termin: {{name}} – {{termin}}',
			heading: 'Neues Erstgespräch gebucht',
			body: '{{details}}'
		},
		absage_kunde: {
			subject: 'Ihr Termin wurde abgesagt',
			heading: 'Ihr Termin wurde abgesagt',
			body: `Guten Tag {{name}},\n\nIhr Erstgespräch am {{termin}} ist abgesagt. Wenn Sie einen neuen Termin möchten, buchen Sie einfach auf der Webseite:\n\n{{knopf}}\n\n${GRUSS}`,
			button: 'Neuen Termin buchen'
		},
		absage_info: {
			subject: 'Termin abgesagt: {{name}} – {{termin}}',
			heading: 'Termin abgesagt',
			body: '{{name}} ({{email}}) hat den Termin am {{termin}} abgesagt.'
		},
		angebot_kunde: {
			subject: 'Ihre Zusage zum Angebot {{nummer}}',
			heading: 'Vielen Dank für Ihre Zusage',
			body: `Guten Tag {{name}},\n\nvielen Dank für Ihr Vertrauen! Sie haben mein Angebot {{nummer}} über {{betrag}} angenommen. Ich melde mich in Kürze mit den nächsten Schritten.\n\n{{details}}\n\n{{knopf}}\n\n${GRUSS}`,
			button: 'Angebot ansehen'
		},
		angebot_info: {
			subject: 'Angebot {{nummer}} angenommen – {{name}}',
			heading: 'Angebot angenommen',
			body: '{{name}} hat das Angebot {{nummer}} über {{betrag}} über den Link angenommen.\n\n{{details}}'
		},
		aenderung_info: {
			subject: 'Änderungswunsch zum Angebot {{nummer}} – {{name}}',
			heading: 'Änderungswunsch zum Angebot',
			body: '{{name}} wünscht Änderungen am Angebot {{nummer}} ({{titel}}):\n\n{{details}}'
		}
	},
	ablauf: {
		telefon: 'Ich rufe Sie zur vereinbarten Zeit unter {{telefon}} an.',
		video: 'Der Video-Call findet hier statt: {{link}}',
		videoOhneLink: 'Den Link zum Video-Call erhalten Sie rechtzeitig vor dem Termin per E-Mail.'
	}
};

/** Gespeicherte Texte mit den Standardtexten ergänzen (auch für später hinzugekommene Mails) */
export function mailSettings(stored?: Partial<MailSettings> | null): MailSettings {
	const web = {} as MailSettings['web'];
	for (const { key } of WEB_MAILS) web[key] = { ...MAIL_DEFAULTS.web[key], ...stored?.web?.[key] };
	return { footer: stored?.footer ?? MAIL_DEFAULTS.footer, web, ablauf: { ...MAIL_DEFAULTS.ablauf, ...stored?.ablauf } };
}

/* ------------------------------------------------------------------ Bausteine */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Platzhalter wie {{name}} ersetzen; unbekannte bleiben stehen, leere Werte verschwinden */
export function fillPlaceholders(text: string, values: Record<string, string | null | undefined>): string {
	return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (all, key: string) => (key in values ? (values[key] ?? '') : all));
}

/** E-Mail-Adressen und Links (in bereits maskiertem Text) klickbar machen */
function linkify(html: string, color: string, bareDomains = false): string {
	// Satzzeichen am Ende gehören nicht zum Link
	const re = bareDomains
		? /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(https?:\/\/[^\s<]*[^\s<.,;:!?)])|\b((?:[a-z0-9-]+\.)+[a-z]{2,12}(?:\/[^\s<]*[^\s<.,;:!?)])?)/gi
		: /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(https?:\/\/[^\s<]*[^\s<.,;:!?)])/gi;
	return html.replace(re, (all, mail?: string, url?: string, bare?: string) => {
		const href = mail ? `mailto:${mail}` : url ? url : `https://${bare}`;
		return `<a href="${href}" style="color:${color}">${all}</a>`;
	});
}

const P = 'margin:0 0 14px;font-size:15px;line-height:1.6';

const buttonHtml = (href: string, label: string) =>
	`<p style="margin:6px 0 18px"><a href="${esc(href)}" style="display:inline-block;background:#5eead4;background-image:linear-gradient(115deg,#5eead4,#8f9bff 52%,#f472b6);color:#0c1430;text-decoration:none;font-weight:bold;padding:11px 18px;border-radius:999px;font-size:14px">${esc(label)}</a></p>`;

/** Ein Absatz, der nur aus [Beschriftung](https://…) besteht, wird zum Knopf */
const BUTTON = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/;

function paragraphHtml(p: string): string {
	const b = BUTTON.exec(p);
	if (b) return buttonHtml(b[2], b[1]);
	return `<p style="${P}">${linkify(esc(p), '#3b4bd8').replace(/\n/g, '<br>')}</p>`;
}

const paragraphs = (text: string) =>
	text
		.trim()
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);

/** Text mit Leerzeilen als Absätze setzen (Mails aus dem Portal) */
export function paragraphsHtml(text: string): string {
	return paragraphs(text).map(paragraphHtml).join('');
}

/** Textfassung derselben Mail: Knöpfe werden zu „Beschriftung: Link“ */
export function plainText(text: string): string {
	return paragraphs(text)
		.map((p) => {
			const b = BUTTON.exec(p);
			return b ? `${b[1]}: ${b[2]}` : p;
		})
		.join('\n\n');
}

export type DetailRows = [string, string | null | undefined][];

function detailsHtml(rows: DetailRows): string {
	const filled = rows.filter((r): r is [string, string] => !!r[1]);
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 18px;font-size:14px;line-height:1.5;border-top:1px solid #e3e6ef">${filled
		.map(
			([k, v]) =>
				`<tr><td style="padding:8px 12px 8px 0;color:#5d6485;vertical-align:top;white-space:nowrap;border-bottom:1px solid #e3e6ef">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #e3e6ef;white-space:pre-wrap">${esc(v)}</td></tr>`
		)
		.join('')}</table>`;
}

const detailsText = (rows: DetailRows) =>
	rows
		.filter((r) => !!r[1])
		.map(([k, v]) => `${k}: ${v}`)
		.join('\n');

/** Rahmen jeder Mail: Kopf mit Logo, Inhalt, Fußzeile. `logo` ist `cid:…` beim Versand, eine Daten-URL in der Vorschau */
export function mailLayout(bodyHtml: string, opts: { heading?: string; footer: string; logo: string }): string {
	const footer = linkify(esc(opts.footer.trim()), '#5d6485', true).replace(/\n/g, '<br>');
	return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head><body style="margin:0;background:#eef0f6;font-family:Helvetica,Arial,sans-serif;color:#141a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0c1430;padding:20px 28px"><img src="${opts.logo}" width="260" height="35" alt="Astronox Development" style="display:block;border:0;outline:none;width:260px;max-width:100%;height:auto;color:#f3eee2;font-size:18px;font-weight:bold"></td></tr>
<tr><td style="padding:28px 28px 12px">${opts.heading ? `<h1 style="margin:0 0 16px;font-size:21px;line-height:1.3">${esc(opts.heading)}</h1>` : ''}${bodyHtml}</td></tr>
${footer ? `<tr><td style="padding:16px 28px 28px;color:#5d6485;font-size:13px;line-height:1.5">${footer}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

export interface RenderedMail {
	subject: string;
	html: string;
	text: string;
}

/** Eine Mail aus Vorlage, Werten und Bausteinen ({{details}}, {{knopf}}) zusammensetzen */
export function renderMail(
	t: MailText,
	values: Record<string, string | null | undefined>,
	blocks: { details?: DetailRows; button?: string },
	opts: { footer: string; logo: string }
): RenderedMail {
	const html: string[] = [];
	const text: string[] = [];
	for (const raw of t.body.split(/\n\s*\n/)) {
		const p = raw.trim();
		if (p === '{{details}}') {
			if (blocks.details) {
				html.push(detailsHtml(blocks.details));
				text.push(detailsText(blocks.details));
			}
		} else if (p === '{{knopf}}') {
			if (blocks.button) {
				const label = t.button?.trim() || 'Öffnen';
				html.push(buttonHtml(blocks.button, label));
				text.push(`${label}: ${blocks.button}`);
			}
		} else {
			const filled = fillPlaceholders(p, values).trim();
			if (!filled) continue;
			html.push(paragraphHtml(filled));
			text.push(plainText(filled));
		}
	}
	const footer = opts.footer.trim();
	return {
		subject: fillPlaceholders(t.subject, values).replace(/\s+/g, ' ').trim(),
		html: mailLayout(html.join(''), { heading: fillPlaceholders(t.heading, values).trim(), footer, logo: opts.logo }),
		text: text.join('\n\n') + (footer ? `\n\n-- \n${footer}` : '')
	};
}
