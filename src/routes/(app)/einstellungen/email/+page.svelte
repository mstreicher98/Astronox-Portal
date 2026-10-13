<script lang="ts">
	import { enhance } from '$app/forms';
	import { Inbox, Info, PlugZap, Send } from '@lucide/svelte';
	import { relative } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const s = $derived(data.smtp);
	const i = $derived(data.imap);
	let same = $state(true);
	let folders = $state<string[]>([]);
	$effect(() => {
		same = !data.imap.user || data.imap.user === data.smtp.user;
	});
</script>

<svelte:head><title>E-Mail – Einstellungen</title></svelte:head>

<p class="notice"><Info size={16} /> Die Zugangsdaten bekommst du bei deinem Mail-Anbieter (Webspace, Zoho, World4You, mailbox.org …). Passwörter werden verschlüsselt gespeichert und nie wieder angezeigt.</p>

<form method="POST" action="?/smtp" class="card stack" use:glow use:enhance={submit()}>
	<h2><Send size={17} /> Versand (SMTP)</h2>
	<p class="small muted">Für Bestätigungen der Webseite (Termine, Anfragen) und alle Mails aus dem Portal.</p>
	<div class="form-grid">
		<label class="field"><span>Server</span><input name="host" value={s.host} placeholder="smtp.anbieter.at" /></label>
		<label class="field"><span>Port</span><input name="port" type="number" value={s.port} /><small class="hint">587 = STARTTLS, 465 = SSL</small></label>
		<label class="field"><span>Benutzer</span><input name="user" value={s.user} autocomplete="off" /></label>
		<label class="field"><span>Passwort {#if s.hasPassword}<small>– gespeichert, leer lassen = unverändert</small>{/if}</span><input name="password" type="password" autocomplete="new-password" /></label>
		<label class="field"><span>Absender</span><input name="from" type="email" value={s.from} /></label>
		<label class="field"><span>Absendername</span><input name="fromName" value={s.fromName} /></label>
		<label class="field full"><span>Benachrichtigungen der Webseite an</span><input name="inbox" type="email" value={s.inbox} /></label>
	</div>
	<label class="switch"><input type="checkbox" name="secure" checked={s.secure} /> Direkt verschlüsselt (SSL, meist Port 465)</label>
	<div class="form-actions">
		<button class="btn ghost" type="submit" formaction="?/smtp_test"><PlugZap size={15} /> Verbindung testen</button>
		<button class="btn" type="submit">Speichern</button>
	</div>
</form>

<form
	method="POST"
	action="?/imap"
	class="card stack"
	use:glow
	use:enhance={submit({
		done: (d) => {
			if (d?.folders) folders = d.folders as string[];
		}
	})}
>
	<h2><Inbox size={17} /> Posteingang mitlesen (IMAP)</h2>
	<p class="small muted">
		Holt alle 2 Minuten neue Mails ins Portal und ordnet sie Kunden zu. Im Postfach wird nichts verändert.
		{#if i.enabled && data.stand.lastSync}Zuletzt {relative(data.stand.lastSync)}{data.stand.lastError ? ` – Fehler: ${data.stand.lastError}` : ''}.{/if}
	</p>
	<label class="switch"><input type="checkbox" name="enabled" checked={i.enabled} /> Mitlesen eingeschaltet</label>
	<div class="form-grid">
		<label class="field"><span>Server</span><input name="host" value={i.host} placeholder="imap.anbieter.at" /></label>
		<label class="field"><span>Port</span><input name="port" type="number" value={i.port} /><small class="hint">993 = SSL</small></label>
	</div>
	<label class="check"><input type="checkbox" name="sameAsSmtp" bind:checked={same} /> Gleicher Benutzer und gleiches Passwort wie beim Versand</label>
	{#if !same}
		<div class="form-grid">
			<label class="field"><span>Benutzer</span><input name="user" value={i.user} autocomplete="off" /></label>
			<label class="field"><span>Passwort {#if i.hasPassword}<small>– leer lassen = unverändert</small>{/if}</span><input name="password" type="password" autocomplete="new-password" /></label>
		</div>
	{/if}
	<div class="form-grid">
		<label class="field"><span>Ordner Posteingang</span><input name="mailbox" value={i.mailbox} list="ordner" /></label>
		<label class="field"><span>Ordner für Gesendetes <small>(leer = nicht ablegen)</small></span><input name="sentMailbox" value={i.sentMailbox} list="ordner" /></label>
	</div>
	<datalist id="ordner">{#each folders as f (f)}<option value={f}></option>{/each}</datalist>
	<label class="switch"><input type="checkbox" name="secure" checked={i.secure} /> SSL</label>
	<div class="form-actions">
		<button class="btn quiet" type="submit" formaction="?/abrufen">Jetzt abrufen</button>
		<button class="btn ghost" type="submit" formaction="?/imap_test"><PlugZap size={15} /> Testen & Ordner laden</button>
		<button class="btn" type="submit">Speichern</button>
	</div>
</form>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
