import { describe, expect, it } from 'vitest';
import { MAIL_DEFAULTS, mailSettings, paragraphsHtml, renderMail } from './mails';

const opts = { footer: 'Astronox Development\noffice@astronox.dev · astronox.dev', logo: 'cid:logo@astronox.dev' };

describe('renderMail', () => {
	it('setzt Platzhalter, Details und Knopf ein', () => {
		const m = renderMail(
			MAIL_DEFAULTS.web.termin_kunde,
			{ name: 'Erika <Muster>', termin: 'Montag, 2. November 2026', datum: 'Montag, 2. November 2026', ablauf: 'Ich rufe Sie an.' },
			{ details: [['Termin', 'Mo'], ['Firma', null]], button: 'https://astronox.dev/termin/abc' },
			opts
		);
		expect(m.subject).toBe('Ihr Erstgespräch am Montag, 2. November 2026');
		expect(m.html).toContain('Guten Tag Erika &lt;Muster&gt;,');
		expect(m.html).toContain('src="cid:logo@astronox.dev"');
		expect(m.html).toContain('href="https://astronox.dev/termin/abc"');
		expect(m.html).not.toContain('Firma');
		expect(m.text).toContain('Termin: Mo');
		expect(m.text).toContain('Termin ansehen oder absagen: https://astronox.dev/termin/abc');
		expect(m.text.endsWith('-- \nAstronox Development\noffice@astronox.dev · astronox.dev')).toBe(true);
	});

	it('lässt leere Absätze weg und macht die Fußzeile klickbar', () => {
		const m = renderMail({ subject: 'x', heading: '', body: 'A\n\n{{grund}}\n\nB' }, { grund: '' }, {}, opts);
		expect(m.text.split('\n\n-- ')[0]).toBe('A\n\nB');
		expect(m.html).toContain('<a href="mailto:office@astronox.dev"');
		expect(m.html).toContain('<a href="https://astronox.dev"');
		expect(m.html).not.toContain('<h1');
	});
});

describe('paragraphsHtml', () => {
	it('verlinkt Adressen ohne Satzzeichen am Ende', () => {
		expect(paragraphsHtml('Buchen unter https://astronox.dev/#kontakt.')).toContain('href="https://astronox.dev/#kontakt"');
	});
});

describe('mailSettings', () => {
	it('ergänzt fehlende Texte mit den Standardtexten', () => {
		const s = mailSettings({ web: { anfrage_kunde: { subject: 'Eigener Betreff' } } } as never);
		expect(s.web.anfrage_kunde.subject).toBe('Eigener Betreff');
		expect(s.web.anfrage_kunde.body).toBe(MAIL_DEFAULTS.web.anfrage_kunde.body);
		expect(s.web.absage_info.subject).toBe(MAIL_DEFAULTS.web.absage_info.subject);
		expect(s.footer).toBe(MAIL_DEFAULTS.footer);
	});
});
