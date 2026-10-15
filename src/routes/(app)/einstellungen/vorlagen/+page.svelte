<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Globe, Mail, Palette, Plus } from '@lucide/svelte';
	import logo from '$lib/assets/mail-logo.png?inline';
	import { WEB_MAILS } from '$lib/shared/mails';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import Template from './Template.svelte';
	import WebMail from './WebMail.svelte';

	let { data } = $props();
	// Fußzeile gilt sofort in allen Vorschauen
	let footer = $state(untrack(() => data.mails.footer));
	let newMail = $state(false);
	// Inhalt (mit Vorschau) erst beim Aufklappen erzeugen
	let open = $state<Record<string, boolean>>({});
	const toggle = (key: string) => (e: Event) => (open[key] = (e.currentTarget as HTMLDetailsElement).open);
</script>

<svelte:head><title>E-Mail-Texte – Einstellungen</title></svelte:head>

<div class="mail-texts stack">
	<div class="card stack" use:glow>
		<h2><Palette size={17} /> Aussehen</h2>
		<div class="logo"><img src={logo} alt="Astronox Development" width="260" height="35" /></div>
		<p class="small muted">Das Logo steht im Kopf jeder Mail – von der Webseite und aus dem Portal. Es hängt eingebettet an der Mail und erscheint ohne „Bilder laden“.</p>
		<form method="POST" action="?/fusszeile" class="stack" use:enhance={submit()}>
			<label class="field">
				<span>Fußzeile <small>(unter jeder Mail – E-Mail- und Webadressen werden klickbar)</small></span>
				<textarea name="footer" rows="3" bind:value={footer}></textarea>
			</label>
			<div class="form-actions"><button class="btn sm" type="submit">Speichern</button></div>
		</form>
	</div>

	<div class="card stack" use:glow>
		<h2><Globe size={17} /> Automatische Mails der Webseite</h2>
		<p class="small muted">Verschickt die Webseite selbst bei Projektanfragen, Terminbuchungen und Absagen. Änderungen gelten ab der nächsten Mail.</p>
		{#each WEB_MAILS as m (m.key)}
			<details class="tpl" ontoggle={toggle(m.key)}>
				<summary><strong>{m.label}</strong> <span class="faint small">{data.mails.web[m.key].subject}</span></summary>
				{#if open[m.key]}<WebMail mail={m} text={data.mails.web[m.key]} ablauf={data.mails.ablauf} {footer} />{/if}
			</details>
		{/each}
	</div>

	<div class="card stack" use:glow>
		<div class="spread">
			<h2><Mail size={17} /> Vorlagen im Portal</h2>
			<button class="btn ghost sm" type="button" onclick={() => (newMail = !newMail)}><Plus size={14} /> Vorlage</button>
		</div>
		<p class="small muted">Für Angebote, Rechnungen, Erinnerungen, Terminabsagen und beim Schreiben einer Mail im Portal. Vor dem Senden lässt sich jede Mail noch anpassen. Ein eigener Absatz <code>[Beschriftung](Link)</code> wird zum Knopf – z. B. <code>{'[Angebot ansehen und antworten]({{link}})'}</code>.</p>
		{#if newMail}
			<div class="tpl"><Template {footer} ondone={() => (newMail = false)} /></div>
		{/if}
		{#each data.templates as t (t.id)}
			<details class="tpl" ontoggle={toggle(`t${t.id}`)}>
				<summary><strong>{t.name}</strong> <span class="faint small">{t.subject}</span></summary>
				{#if open[`t${t.id}`]}<Template {t} fixed={!!t.key && data.fixed.includes(t.key)} {footer} />{/if}
			</details>
		{/each}
	</div>
</div>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo {
		justify-self: start;
		padding: 1rem 1.4rem;
		border-radius: 12px;
		background: #0c1430;
		border: 1px solid var(--line-soft);
	}

	.logo img {
		display: block;
		width: 260px;
		max-width: 100%;
		height: auto;
	}

	.tpl {
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--line-soft);
		border-radius: 14px;
		background: rgb(7 13 36 / 0.35);
	}

	.tpl summary {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.2rem 0.6rem;
		cursor: pointer;
	}

	.tpl[open] summary {
		margin-bottom: 0.8rem;
	}

	/* Editor links, Vorschau rechts – auf schmalen Bildschirmen untereinander */
	.mail-texts :global(.pair) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.mail-texts :global(fieldset) {
		margin: 0;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
	}

	.mail-texts :global(legend) {
		padding: 0 0.3rem;
		color: var(--dust);
		font-size: 0.82rem;
	}

	.mail-texts :global(code) {
		padding: 0.05rem 0.3rem;
		border-radius: 5px;
		background: var(--nebula-soft);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}

	@media (max-width: 1250px) {
		.mail-texts :global(.pair) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
