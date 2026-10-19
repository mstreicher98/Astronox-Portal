<script lang="ts">
	import { enhance } from '$app/forms';
	import { Inbox, Info, PlugZap, Send } from '@lucide/svelte';
	import { relative } from '$lib/shared/format';
	import type { MailAuth } from '$lib/shared/settings';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import AuthChoice from './AuthChoice.svelte';
	import MicrosoftCard from './MicrosoftCard.svelte';

	let { data } = $props();
	const s = $derived(data.smtp);
	const i = $derived(data.imap);
	let same = $state(true);
	let smtpAuth = $state<MailAuth>('passwort');
	let imapAuth = $state<MailAuth>('passwort');
	let smtpUser = $state('');
	let folders = $state<string[]>([]);
	// Gespeicherte Werte nur übernehmen, wenn sie sich ändern – nicht bei jedem
	// Neuladen der Seitenleiste (sonst springt eine noch nicht gespeicherte Auswahl zurück)
	const savedSame = $derived(!data.imap.user || (data.imap.user === data.smtp.user && data.imap.auth === data.smtp.auth));
	const savedSmtpAuth = $derived(data.smtp.auth);
	const savedImapAuth = $derived(data.imap.auth);
	const savedUser = $derived(data.smtp.user);
	$effect(() => {
		same = savedSame;
	});
	$effect(() => {
		smtpAuth = savedSmtpAuth;
	});
	$effect(() => {
		imapAuth = savedImapAuth;
	});
	$effect(() => {
		smtpUser = savedUser;
	});

	const imapMs = $derived((same ? smtpAuth : imapAuth) === 'microsoft');
	const showMicrosoft = $derived(smtpAuth === 'microsoft' || imapMs || !!data.microsoft.clientId);
</script>

<svelte:head><title>E-Mail – Einstellungen</title></svelte:head>

<p class="notice">
	<Info size={16} /> Die Zugangsdaten bekommst du bei deinem Mail-Anbieter (Webspace, Zoho, World4You, mailbox.org …). Für Microsoft 365 wählst du „Microsoft 365“ statt Passwort.
	Passwörter und Schlüssel werden verschlüsselt gespeichert und nie wieder angezeigt.
</p>

<form method="POST" action="?/smtp" class="card stack" use:glow use:enhance={submit()}>
	<h2><Send size={17} /> Versand (SMTP)</h2>
	<p class="small muted">Für Bestätigungen der Webseite (Termine, Anfragen) und alle Mails aus dem Portal.</p>
	<AuthChoice bind:value={smtpAuth} />
	<div class="form-grid">
		{#if smtpAuth === 'microsoft'}
			<label class="field full">
				<span>Postfach</span>
				<input name="user" type="email" bind:value={smtpUser} placeholder="office@astronox.dev" autocomplete="off" />
				<small class="hint">Server smtp.office365.com, Port 587 – fest eingestellt. Die App-Daten trägst du unten unter „Microsoft 365“ ein.</small>
			</label>
		{:else}
			<label class="field"><span>Server</span><input name="host" value={s.host} placeholder="smtp.anbieter.at" /></label>
			<label class="field"><span>Port</span><input name="port" type="number" value={s.port} /><small class="hint">587 = STARTTLS, 465 = SSL</small></label>
			<label class="field"><span>Benutzer</span><input name="user" bind:value={smtpUser} autocomplete="off" /></label>
			<label class="field"><span>Passwort {#if s.hasPassword}<small>– gespeichert, leer lassen = unverändert</small>{/if}</span><input name="password" type="password" autocomplete="new-password" /></label>
		{/if}
		<label class="field">
			<span>Absender</span><input name="from" type="email" value={s.from} />
			{#if smtpAuth === 'microsoft'}<small class="hint">Adresse des Postfachs (oder eine mit „Senden als“)</small>{/if}
		</label>
		<label class="field"><span>Absendername</span><input name="fromName" value={s.fromName} /></label>
		<label class="field full"><span>Benachrichtigungen der Webseite an</span><input name="inbox" type="email" value={s.inbox} /></label>
	</div>
	{#if smtpAuth === 'passwort'}
		<label class="switch"><input type="checkbox" name="secure" checked={s.secure} /> Direkt verschlüsselt (SSL, meist Port 465)</label>
	{/if}
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
		Holt alle 2 Minuten neue Mails ins Portal und ordnet sie Kunden zu. Gelesen und Löschen übernimmt das Portal ins Postfach – gelöschte Mails landen dort im Papierkorb.
		{#if i.enabled && data.stand.lastSync}Zuletzt {relative(data.stand.lastSync)}{data.stand.lastError ? ` – Fehler: ${data.stand.lastError}` : ''}.{/if}
	</p>
	<label class="switch"><input type="checkbox" name="enabled" checked={i.enabled} /> Mitlesen eingeschaltet</label>
	<label class="check">
		<input type="checkbox" name="sameAsSmtp" bind:checked={same} />
		{smtpAuth === 'microsoft' ? 'Gleiches Postfach wie beim Versand (Microsoft 365)' : 'Gleicher Benutzer und gleiches Passwort wie beim Versand'}
	</label>
	{#if !same}
		<AuthChoice bind:value={imapAuth} />
		<div class="form-grid">
			<label class="field"><span>{imapAuth === 'microsoft' ? 'Postfach' : 'Benutzer'}</span><input name="user" value={i.user} autocomplete="off" /></label>
			{#if imapAuth === 'passwort'}
				<label class="field"><span>Passwort {#if i.hasPassword}<small>– leer lassen = unverändert</small>{/if}</span><input name="password" type="password" autocomplete="new-password" /></label>
			{/if}
		</div>
	{/if}
	{#if imapMs}
		<p class="small muted">Server outlook.office365.com, Port 993 mit SSL – fest eingestellt.</p>
	{:else}
		<div class="form-grid">
			<label class="field"><span>Server</span><input name="host" value={i.host} placeholder="imap.anbieter.at" /></label>
			<label class="field"><span>Port</span><input name="port" type="number" value={i.port} /><small class="hint">993 = SSL</small></label>
		</div>
	{/if}
	<div class="form-grid">
		<label class="field"><span>Ordner Posteingang</span><input name="mailbox" value={i.mailbox} list="ordner" /></label>
		{#if smtpAuth === 'microsoft'}
			<p class="field small muted sent-note">Gesendete Mails legt Microsoft 365 selbst in „Gesendete Elemente“ ab.</p>
		{:else}
			<label class="field"><span>Ordner für Gesendetes <small>(leer = nicht ablegen)</small></span><input name="sentMailbox" value={i.sentMailbox} list="ordner" /></label>
		{/if}
	</div>
	<datalist id="ordner">{#each folders as f (f)}<option value={f}></option>{/each}</datalist>
	{#if !imapMs}
		<label class="switch"><input type="checkbox" name="secure" checked={i.secure} /> SSL</label>
	{/if}
	<div class="form-actions">
		<button class="btn quiet" type="submit" formaction="?/abrufen">Jetzt abrufen</button>
		<button class="btn ghost" type="submit" formaction="?/imap_test"><PlugZap size={15} /> Testen & Ordner laden</button>
		<button class="btn" type="submit">Speichern</button>
	</div>
</form>

{#if showMicrosoft}
	<MicrosoftCard ms={data.microsoft} mailbox={smtpUser || s.from} />
{/if}

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.sent-note {
		align-self: end;
		margin: 0;
		padding-bottom: 0.7rem;
	}
</style>
