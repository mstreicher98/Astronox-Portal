<script lang="ts">
	import { enhance } from '$app/forms';
	import { Archive, DatabaseBackup, Download, Info } from '@lucide/svelte';
	import { bytes, dateTime } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
</script>

<svelte:head><title>Sicherungen – Einstellungen</title></svelte:head>

<div class="card stack" use:glow>
	<div class="spread">
		<h2><DatabaseBackup size={17} /> Tägliche Sicherung</h2>
		<form method="POST" action="?/jetzt" use:enhance={submit()}><button class="btn ghost sm" type="submit">Jetzt sichern</button></form>
	</div>
	<p class="small muted">Jeden Tag ab 3 Uhr wird die Datenbank (Webseite und Portal) nach <code>/data/sicherungen</code> kopiert. Die letzten 14 bleiben.</p>
	{#if data.backups.length}
		<ul class="list">
			{#each data.backups as b (b.name)}
				<li class="spread">
					<span class="mono small">{b.name}</span>
					<span class="small faint">{dateTime(b.at)} · {bytes(b.size)}</span>
					<a class="btn quiet icon sm" href="/einstellungen/sicherungen/{b.name}" aria-label="Herunterladen" data-sveltekit-reload><Download size={15} /></a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="small faint">Noch keine Sicherung – die erste entsteht heute Nacht.</p>
	{/if}
</div>

<div class="card stack" use:glow>
	<h2><Archive size={17} /> Komplettes Archiv</h2>
	<p class="small muted">Datenbank, Bilder der Webseite, Dateien, Mail-Anhänge, festgeschriebene PDFs und der Schlüssel für verschlüsselte Daten in einer .tar.gz-Datei. Zum Umziehen oder für die Sicherung außer Haus.</p>
	<a class="btn" href="/einstellungen/sicherungen/archiv" data-sveltekit-reload><Download size={15} /> Archiv herunterladen</a>
	<p class="notice small"><Info size={16} /> Das Archiv enthält den Schlüssel <code>.schluessel</code> – damit lassen sich Passwörter und Zugänge entschlüsseln. Sicher aufbewahren.</p>
</div>

<div class="card stack" use:glow>
	<h2>Wiederherstellen</h2>
	<ol class="small steps">
		<li>In Portainer den Stack stoppen.</li>
		<li>Im Volume <code>astronox-data</code> die Datei <code>astronox.db</code> durch die Sicherung ersetzen (umbenennen in <code>astronox.db</code>, die Dateien <code>-wal</code> und <code>-shm</code> löschen).</li>
		<li>Bei einem Komplettarchiv: Inhalt ins Volume entpacken.</li>
		<li>Stack wieder starten.</li>
	</ol>
</div>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	code {
		padding: 0.05rem 0.3rem;
		border-radius: 5px;
		background: var(--nebula-soft);
		font-family: var(--font-mono);
		font-size: 0.78em;
	}

	li.spread {
		padding: 0.45rem 0;
		gap: 1rem;
	}

	li.spread .mono {
		flex: 1;
	}

	.steps {
		display: grid;
		gap: 0.4rem;
		margin: 0;
		padding-left: 1.2rem;
		color: var(--dust);
	}
</style>
