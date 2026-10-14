<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import logo from '$lib/assets/mail-logo.png?inline';
	import MailPreview from '$lib/components/MailPreview.svelte';
	import { fillPlaceholders, mailLayout, paragraphsHtml } from '$lib/shared/mails';
	import { submit } from '$lib/ui/form';
	import { insertAt } from './insert';
	import Placeholders from './Placeholders.svelte';

	interface Row {
		id: number;
		key: string | null;
		name: string;
		subject: string;
		body: string;
	}
	let { t, fixed = false, footer, ondone }: { t?: Row; fixed?: boolean; footer: string; ondone?: () => void } = $props();

	const init = untrack(() => t ?? { key: null, name: '', subject: '', body: '{{anrede}}\n\n\n\nViele Grüße\nMatthias Streicher' });
	let name = $state(init.name);
	let subject = $state(init.subject);
	let body = $state(init.body);
	let area = $state<HTMLTextAreaElement>();

	const FIELDS = ['anrede', 'name', 'projekt', 'nummer', 'titel', 'betrag', 'datum', 'zeitraum', 'grund', 'link'];
	// Beispieldaten für die Vorschau
	const values = {
		anrede: 'Guten Tag Erika Muster,',
		name: 'Tischlerei Muster',
		projekt: 'Neue Webseite',
		nummer: init.key === 'angebot' ? 'AN26 0001' : 'RE26 0001',
		titel: 'Neue Webseite',
		betrag: '€ 1.690,00',
		datum: init.key === 'terminabsage' ? '02.11.2026, 17:00' : '14.11.2026',
		zeitraum: 'November 2026',
		grund: init.key === 'terminabsage' ? 'Mir ist leider kurzfristig etwas dazwischengekommen.' : '',
		link: 'https://astronox.dev/angebot/beispiel'
	};
	const preview = $derived({
		subject: fillPlaceholders(subject, values),
		html: mailLayout(paragraphsHtml(fillPlaceholders(body, values)), { footer, logo })
	});
</script>

<div class="pair">
	<form method="POST" action="?/mail" class="stack" use:enhance={submit({ done: ondone })}>
		{#if t}<input type="hidden" name="id" value={t.id} />{/if}
		<div class="form-grid">
			<label class="field"><span>Name</span><input name="name" required bind:value={name} /></label>
			<label class="field"><span>Betreff</span><input name="subject" required bind:value={subject} /></label>
		</div>
		<label class="field"><span>Text <small>(Leerzeile = neuer Absatz)</small></span><textarea name="body" rows="11" required bind:value={body} bind:this={area}></textarea></label>
		<Placeholders fields={FIELDS} oninsert={(f) => insertAt(area, body, f, (v) => (body = v))} />
		<div class="form-actions">
			{#if t && !fixed}<button class="btn danger sm" type="submit" formaction="?/mail_loeschen">Löschen</button>{/if}
			<button class="btn sm" type="submit">{t ? 'Speichern' : 'Anlegen'}</button>
		</div>
	</form>
	<MailPreview html={preview.html} subject={preview.subject} />
</div>
