import { eq } from 'drizzle-orm';
import { db } from './db';
import { checklistTemplates, mailTemplates } from './db/schema';

/**
 * Startwerte beim ersten Start: Mail-Vorlagen und eine Launch-Checkliste.
 * Platzhalter in Vorlagen: {{anrede}}, {{name}}, {{nummer}}, {{titel}}, {{betrag}}, {{datum}}, {{projekt}}, {{zeitraum}}, {{grund}}.
 */

/** Vorlagen, die das Portal selbst verschickt – lassen sich ändern, aber nicht löschen */
export const FIXED_TEMPLATES = ['angebot', 'rechnung', 'mahnung', 'vertragsrechnung', 'terminabsage'];

const TEMPLATES = [
	{
		key: 'antwort',
		name: 'Antwort auf eine Anfrage',
		subject: 'Ihre Anfrage bei Astronox Development',
		body: `{{anrede}}

vielen Dank für Ihre Anfrage und Ihr Interesse an einer Zusammenarbeit.

Am besten besprechen wir Ihr Vorhaben in einem kurzen, kostenlosen Erstgespräch. Einen Termin können Sie direkt hier buchen: https://astronox.dev/#kontakt

Viele Grüße
Matthias Streicher`
	},
	{
		key: 'angebot',
		name: 'Angebot senden',
		subject: 'Angebot {{nummer}} – {{titel}}',
		body: `{{anrede}}

vielen Dank für das angenehme Gespräch. Wie besprochen sende ich Ihnen im Anhang mein Angebot {{nummer}} über {{betrag}}.

Das Angebot ist bis {{datum}} gültig. Wenn alles passt, genügt eine kurze Antwort auf diese Mail – dann lege ich los.

Viele Grüße
Matthias Streicher`
	},
	{
		key: 'rechnung',
		name: 'Rechnung senden',
		subject: 'Rechnung {{nummer}} – {{titel}}',
		body: `{{anrede}}

vielen Dank für Ihren Auftrag. Im Anhang finden Sie die Rechnung {{nummer}} über {{betrag}}, zahlbar bis {{datum}}.

Viele Grüße
Matthias Streicher`
	},
	{
		key: 'vertragsrechnung',
		name: 'Rechnung zu einem Vertrag (automatisch)',
		subject: 'Rechnung {{nummer}} – {{titel}}',
		body: `{{anrede}}

im Anhang finden Sie die Rechnung {{nummer}} für den Zeitraum {{zeitraum}} über {{betrag}}, zahlbar bis {{datum}}.

Vielen Dank für Ihr Vertrauen und viele Grüße
Matthias Streicher`
	},
	{
		key: 'mahnung',
		name: 'Zahlungserinnerung',
		subject: 'Zahlungserinnerung zu Rechnung {{nummer}}',
		body: `{{anrede}}

sicher ist es Ihnen im Alltag durchgerutscht: Die Rechnung {{nummer}} über {{betrag}} war am {{datum}} fällig. Die Rechnung finden Sie zur Sicherheit noch einmal im Anhang.

Falls Sie bereits bezahlt haben, betrachten Sie diese Nachricht bitte als gegenstandslos.

Viele Grüße
Matthias Streicher`
	},
	{
		key: 'terminabsage',
		name: 'Termin absagen',
		subject: 'Ihr Erstgespräch muss leider entfallen',
		body: `{{anrede}}

leider muss ich unser Erstgespräch am {{datum}} Uhr absagen.

{{grund}}

Bitte buchen Sie einfach einen neuen Termin unter https://astronox.dev/#kontakt – oder antworten Sie auf diese Mail, dann finden wir gemeinsam einen.

Viele Grüße
Matthias Streicher`
	},
	{
		key: 'abnahme',
		name: 'Bitte um Abnahme',
		subject: 'Ihr Projekt ist bereit zur Abnahme: {{projekt}}',
		body: `{{anrede}}

gute Nachrichten: {{projekt}} ist fertig und kann geprüft werden.

Bitte sehen Sie sich alles in Ruhe an und geben Sie mir Bescheid, ob alles passt oder ob Sie noch Änderungen wünschen.

Viele Grüße
Matthias Streicher`
	}
];

const LAUNCH = [
	'Inhalte und Bilder vollständig',
	'Impressum und Datenschutz geprüft',
	'Auf Handy, Tablet und PC getestet',
	'Formulare und E-Mails getestet',
	'Ladezeit und Lighthouse geprüft',
	'Domain und DNS umgestellt',
	'HTTPS aktiv und Weiterleitungen gesetzt',
	'Alte Adressen weitergeleitet',
	'Sitemap bei Google eingereicht',
	'Sicherung eingerichtet',
	'Überwachung im Portal angelegt',
	'Einschulung durchgeführt'
];

export async function seedPortal() {
	const [anyTemplate] = await db.select({ id: mailTemplates.id }).from(mailTemplates).limit(1);
	if (!anyTemplate) await db.insert(mailTemplates).values(TEMPLATES);
	else {
		// später hinzugekommene Vorlagen, die das Portal selbst braucht
		for (const key of ['vertragsrechnung', 'terminabsage']) {
			const [found] = await db.select({ id: mailTemplates.id }).from(mailTemplates).where(eq(mailTemplates.key, key)).limit(1);
			if (!found) await db.insert(mailTemplates).values(TEMPLATES.filter((t) => t.key === key));
		}
	}
	const [anyList] = await db.select({ id: checklistTemplates.id }).from(checklistTemplates).limit(1);
	if (!anyList) {
		await db.insert(checklistTemplates).values([
			{ name: 'Launch-Checkliste', items: JSON.stringify(LAUNCH) },
			{ name: 'Projektstart', items: JSON.stringify(['Angebot angenommen', 'Anzahlung erhalten', 'Inhalte angefordert', 'Repository angelegt', 'Testadresse eingerichtet']) }
		]);
	}
}
