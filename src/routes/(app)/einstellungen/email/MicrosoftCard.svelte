<script lang="ts">
	import { enhance } from '$app/forms';
	import { BookOpen, Copy, KeyRound, PlugZap, TriangleAlert } from '@lucide/svelte';
	import { date } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	interface Props {
		ms: { tenantId: string; clientId: string; objectId: string; secretExpires: string; hasSecret: boolean };
		/** Postfach für die Befehle in der Anleitung */
		mailbox: string;
	}

	let { ms, mailbox }: Props = $props();

	// Gebunden, damit die Befehle in der Anleitung gleich die richtigen IDs enthalten
	// (nur bei geänderten gespeicherten Werten neu setzen, nicht bei jedem Neuladen der Seitenleiste)
	let clientId = $state('');
	let objectId = $state('');
	const savedClient = $derived(ms.clientId);
	const savedObject = $derived(ms.objectId);
	$effect(() => {
		clientId = savedClient;
	});
	$effect(() => {
		objectId = savedObject;
	});

	const box = $derived(mailbox.trim() || 'office@astronox.dev');
	const commands = $derived(
		[
			'Install-Module -Name ExchangeOnlineManagement -Scope CurrentUser',
			'Connect-ExchangeOnline',
			`$app = New-ServicePrincipal -AppId ${clientId.trim() || '<Anwendungs-ID>'} -ObjectId ${objectId.trim() || '<Objekt-ID>'} -DisplayName "Astronox Portal"`,
			`Add-MailboxPermission -Identity ${box} -User $app.Identity -AccessRights FullAccess`,
			`Set-CASMailbox -Identity ${box} -SmtpClientAuthenticationDisabled $false`
		].join('\n')
	);

	const daysLeft = $derived(ms.hasSecret && ms.secretExpires ? Math.ceil((Date.parse(`${ms.secretExpires}T00:00:00Z`) - Date.now()) / 86_400_000) : null);

	async function copy() {
		await navigator.clipboard.writeText(commands);
		toast('Befehle kopiert');
	}
</script>

<form method="POST" action="?/microsoft" class="card stack" use:glow use:enhance={submit()}>
	<h2><KeyRound size={17} /> Microsoft 365</h2>
	<p class="small muted">
		Versand und Posteingang melden sich über eine App in deinem Microsoft-Konto an – ohne Passwort. Microsoft lässt IMAP nur noch so zu, SMTP mit Passwort ab Ende 2026 standardmäßig auch nicht mehr.
	</p>
	{#if daysLeft !== null && daysLeft <= 30}
		<p class="notice {daysLeft < 0 ? 'danger' : 'warn'}">
			<TriangleAlert size={16} />
			{daysLeft < 0 ? `Der geheime Schlüssel ist seit ${date(ms.secretExpires)} abgelaufen` : `Der geheime Schlüssel läuft am ${date(ms.secretExpires)} ab`} – in Entra einen neuen anlegen und hier eintragen.
		</p>
	{/if}
	<div class="form-grid">
		<label class="field"><span>Verzeichnis-ID (Mandant)</span><input name="tenantId" value={ms.tenantId} autocomplete="off" spellcheck="false" /></label>
		<label class="field"><span>Anwendungs-ID (Client)</span><input name="clientId" bind:value={clientId} autocomplete="off" spellcheck="false" /></label>
		<label class="field">
			<span>Geheimer Schlüssel (Wert) {#if ms.hasSecret}<small>– gespeichert, leer lassen = unverändert</small>{/if}</span>
			<input name="clientSecret" type="password" autocomplete="new-password" />
		</label>
		<label class="field">
			<span>Schlüssel gültig bis</span>
			<input name="secretExpires" type="date" value={ms.secretExpires} />
			<small class="hint">Das Portal erinnert dich einen Monat vorher.</small>
		</label>
		<label class="field full">
			<span>Objekt-ID der Unternehmensanwendung <small>(nur für die Befehle in der Anleitung)</small></span>
			<input name="objectId" bind:value={objectId} autocomplete="off" spellcheck="false" />
		</label>
	</div>

	<details class="guide">
		<summary><BookOpen size={15} /> Anleitung: App bei Microsoft einrichten (ca. 15 Minuten)</summary>
		<ol>
			<li>
				<a href="https://entra.microsoft.com" target="_blank" rel="noreferrer">entra.microsoft.com</a> mit deinem Administrator-Konto öffnen →
				<b>Anwendungen → App-Registrierungen → Neue Registrierung</b>. Name z. B. „Astronox Portal“, Kontotyp „Nur Konten in diesem Organisationsverzeichnis“, keine Umleitungs-URI.
			</li>
			<li>Auf der Übersicht der App stehen <b>Anwendungs-ID (Client)</b> und <b>Verzeichnis-ID (Mandant)</b> – oben eintragen.</li>
			<li>
				<b>Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel</b>, Ablauf 24 Monate. Den <b>Wert</b> gleich kopieren (er wird nur einmal angezeigt) und oben samt
				Ablaufdatum eintragen.
			</li>
			<li>
				<b>API-Berechtigungen → Berechtigung hinzufügen → Von meiner Organisation verwendete APIs → Office 365 Exchange Online → Anwendungsberechtigungen</b>:
				<code>SMTP.SendAsApp</code> und <code>IMAP.AccessAsApp</code> anhaken und hinzufügen. Danach <b>Administratorzustimmung erteilen</b>.
			</li>
			<li>
				<b>Unternehmensanwendungen</b> → deine App öffnen → <b>Objekt-ID</b> oben eintragen. Wichtig: die aus den Unternehmensanwendungen, nicht die aus den
				App-Registrierungen.
			</li>
			<li>
				PowerShell öffnen und diese Befehle ausführen – beim Verbinden meldest du dich als Administrator an:
				<div class="code">
					<pre>{commands}</pre>
					<button class="btn quiet sm" type="button" onclick={copy}><Copy size={14} /> Kopieren</button>
				</div>
				Damit kommt die App nur in dein Postfach <b>{box}</b>, und SMTP AUTH ist dafür eingeschaltet.
			</li>
			<li>
				Hier <b>Anmeldung testen</b>, dann bei Versand und Posteingang „Microsoft 365“ wählen und dort testen. Neue Berechtigungen brauchen bei Microsoft manchmal bis zu
				einer halben Stunde.
			</li>
		</ol>
	</details>

	<div class="form-actions">
		<button class="btn ghost" type="submit" formaction="?/microsoft_test"><PlugZap size={15} /> Anmeldung testen</button>
		<button class="btn" type="submit">Speichern</button>
	</div>
</form>

<style>
	h2,
	summary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.guide {
		border: 1px solid var(--line);
		border-radius: 0.9rem;
		background: rgb(7 13 36 / 0.35);
	}

	summary {
		padding: 0.8rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.guide[open] summary {
		border-bottom: 1px solid var(--line);
	}

	ol {
		display: grid;
		gap: 0.75rem;
		margin: 0;
		padding: 1rem 1.25rem 1.1rem 2.4rem;
		color: var(--dust);
		font-size: 0.92rem;
		line-height: 1.6;
	}

	b {
		color: var(--star);
		font-weight: 600;
	}

	code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		color: var(--accent);
	}

	.code {
		position: relative;
		margin-block: 0.6rem;
		border: 1px solid var(--line);
		border-radius: 0.7rem;
		background: rgb(4 8 24 / 0.7);
	}

	pre {
		margin: 0;
		padding: 0.85rem 1rem;
		padding-right: 7.5rem;
		overflow-x: auto;
		color: var(--star);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		line-height: 1.7;
		white-space: pre;
	}

	.code .btn {
		position: absolute;
		top: 0.45rem;
		right: 0.45rem;
	}

	@media (max-width: 640px) {
		pre {
			padding-right: 1rem;
			padding-top: 2.8rem;
		}
	}
</style>
