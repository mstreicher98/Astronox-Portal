<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { RotateCcw } from '@lucide/svelte';
	import logo from '$lib/assets/mail-logo.png?inline';
	import MailPreview from '$lib/components/MailPreview.svelte';
	import { MAIL_DEFAULTS, WEB_MAILS, fillPlaceholders, renderMail, type DetailRows, type MailSettings, type MailText } from '$lib/shared/mails';
	import { submit } from '$lib/ui/form';
	import { insertAt } from './insert';
	import Placeholders from './Placeholders.svelte';

	let { mail, text, ablauf, footer }: { mail: (typeof WEB_MAILS)[number]; text: MailText; ablauf: MailSettings['ablauf']; footer: string } = $props();

	const init = untrack(() => ({ text: { ...text }, ablauf: { ...ablauf } }));
	let subject = $state(init.text.subject);
	let heading = $state(init.text.heading);
	let body = $state(init.text.body);
	let button = $state(init.text.button ?? '');
	let ab = $state(init.ablauf);
	let area = $state<HTMLTextAreaElement>();

	const def = $derived(MAIL_DEFAULTS.web[mail.key]);

	function standard() {
		subject = def.subject;
		heading = def.heading;
		body = def.body;
		button = def.button ?? '';
		if (mail.key === 'termin_kunde') ab = { ...MAIL_DEFAULTS.ablauf };
	}

	// Beispieldaten für die Vorschau
	const termin = 'Montag, 2. November 2026, 17:00 bis 17:30 Uhr';
	const inquiry: DetailRows = [
		['Projekt', 'Neue Webseite'],
		['Budget', '2.000 bis 5.000 €'],
		['Zeitrahmen', 'In 1 bis 3 Monaten'],
		['Name', 'Erika Muster'],
		['Firma', 'Tischlerei Muster'],
		['E-Mail', 'erika@example.com'],
		['Nachricht', 'Wir brauchen eine neue Webseite für unsere Tischlerei.']
	];
	const blocks: Record<string, { details?: DetailRows; button?: string }> = {
		anfrage_kunde: { details: inquiry },
		anfrage_info: { details: inquiry },
		termin_kunde: {
			details: [
				['Termin', termin],
				['Art', 'Video-Call'],
				['Ihr Anliegen', 'Neue Webseite für die Tischlerei']
			],
			button: 'https://astronox.dev/termin/beispiel'
		},
		termin_info: {
			details: [
				['Termin', termin],
				['Art', 'Video-Call'],
				['Name', 'Erika Muster'],
				['E-Mail', 'erika@example.com'],
				['Anliegen', 'Neue Webseite für die Tischlerei']
			]
		},
		absage_kunde: { button: 'https://astronox.dev/#kontakt' },
		absage_info: {},
		angebot_kunde: {
			details: [
				['Angebot', 'AN26 0001 – Neue Webseite'],
				['Betrag', '€ 1.690,00'],
				['Angenommen am', 'Montag, 2. November 2026, 17:42 Uhr'],
				['Angenommen von', 'Erika Muster']
			],
			button: 'https://astronox.dev/angebot/beispiel'
		},
		angebot_info: {
			details: [
				['Angebot', 'AN26 0001 – Neue Webseite'],
				['Betrag', '€ 1.690,00'],
				['Angenommen von', 'Erika Muster'],
				['Zeitpunkt', 'Montag, 2. November 2026, 17:42 Uhr'],
				['Nachricht', 'Start gerne im Dezember.']
			]
		},
		aenderung_info: {
			details: [
				['Angebot', 'AN26 0001 – Neue Webseite'],
				['Betrag', '€ 1.690,00'],
				['Von', 'Erika Muster'],
				['Wünsche', 'Bitte noch eine Seite für Referenzen dazu und ohne Hosting.']
			]
		}
	};
	const preview = $derived(
		renderMail(
			{ subject, heading, body, button },
			{
				name: 'Erika Muster',
				email: 'erika@example.com',
				termin,
				datum: 'Montag, 2. November 2026',
				art: 'Video-Call',
				projekt: 'Neue Webseite',
				nummer: 'AN26 0001',
				titel: 'Neue Webseite',
				betrag: '€ 1.690,00',
				ablauf: fillPlaceholders(ab.video, { link: 'https://meet.example.com/astronox' })
			},
			blocks[mail.key],
			{ footer, logo }
		)
	);
</script>

<div class="pair">
	<form method="POST" action="?/webseite" class="stack" use:enhance={submit()}>
		<input type="hidden" name="key" value={mail.key} />
		<label class="field"><span>Betreff</span><input name="subject" required bind:value={subject} /></label>
		<label class="field"><span>Überschrift <small>(leer = keine)</small></span><input name="heading" bind:value={heading} /></label>
		<label class="field"><span>Text <small>(Leerzeile = neuer Absatz)</small></span><textarea name="body" rows="11" required bind:value={body} bind:this={area}></textarea></label>
		<Placeholders fields={mail.fields} oninsert={(f) => insertAt(area, body, f, (v) => (body = v))} />
		{#if def.button !== undefined}
			<label class="field"><span>Beschriftung des Knopfs</span><input name="button" bind:value={button} /></label>
		{/if}
		{#if mail.key === 'termin_kunde'}
			<fieldset class="stack">
				<legend>Satz für <code>{'{{ablauf}}'}</code></legend>
				<label class="field"><span>Telefon <small>– <code>{'{{telefon}}'}</code> wird zur Nummer</small></span><input name="ablauf_telefon" bind:value={ab.telefon} /></label>
				<label class="field"><span>Video-Call mit Link <small>– <code>{'{{link}}'}</code> aus Einstellungen → Termine</small></span><input name="ablauf_video" bind:value={ab.video} /></label>
				<label class="field"><span>Video-Call, noch ohne Link</span><input name="ablauf_ohne" bind:value={ab.videoOhneLink} /></label>
			</fieldset>
		{/if}
		<div class="form-actions">
			<button class="btn quiet sm" type="button" onclick={standard} title="Standardtext einsetzen – erst „Speichern“ übernimmt ihn"><RotateCcw size={14} /> Standardtext</button>
			<button class="btn sm" type="submit">Speichern</button>
		</div>
	</form>
	<MailPreview html={preview.html} subject={preview.subject} />
</div>
