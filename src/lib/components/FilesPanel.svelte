<script lang="ts">
	import { enhance } from '$app/forms';
	import { Download, File, FileArchive, FileCode, FileImage, FileText, Mail, Trash2, Upload } from '@lucide/svelte';
	import { bytes, relative } from '$lib/shared/format';
	import { submit } from '$lib/ui/form';

	/** Dateien zu Kunde oder Projekt – hochladen per Ziehen oder Auswahl */
	type F = { id: number; name: string; mime: string; size: number; source: string; createdAt: string };
	let { files }: { files: F[] } = $props();

	let input = $state<HTMLInputElement>();
	let form = $state<HTMLFormElement>();
	let hover = $state(false);

	function drop(e: DragEvent) {
		e.preventDefault();
		hover = false;
		if (!e.dataTransfer?.files.length || !input || !form) return;
		input.files = e.dataTransfer.files;
		form.requestSubmit();
	}

	const icon = (mime: string, name: string) =>
		mime.startsWith('image/') ? FileImage : mime === 'application/pdf' || /\.(docx?|txt|md)$/i.test(name) ? FileText : /zip|tar|gz|7z/.test(mime) ? FileArchive : /json|javascript|html|css|xml/.test(mime) ? FileCode : File;
</script>

<form method="POST" action="?/dateien" enctype="multipart/form-data" bind:this={form} use:enhance={submit({ reset: true })}>
	<label
		class="drop"
		class:hover
		ondragover={(e) => {
			e.preventDefault();
			hover = true;
		}}
		ondragleave={() => (hover = false)}
		ondrop={drop}
	>
		<Upload size={22} />
		<span><strong>Dateien hierher ziehen</strong> oder klicken zum Auswählen</span>
		<small>Logos, Texte, Verträge … bis 50 MB je Datei</small>
		<input bind:this={input} type="file" name="files" multiple class="sr-only" onchange={() => form?.requestSubmit()} />
	</label>
</form>

{#if files.length}
	<ul class="list files stagger">
		{#each files as f, i (f.id)}
			{@const Icon = icon(f.mime, f.name)}
			<li style="--i: {i}">
				<span class="ico"><Icon size={17} /></span>
				<a class="name" href="/dateien/{f.id}" target="_blank" rel="noopener">{f.name}</a>
				{#if f.source === 'mail'}<span class="badge info" title="Anhang einer E-Mail"><Mail size={11} /> Mail</span>{/if}
				<span class="meta">{bytes(f.size)} · {relative(f.createdAt)}</span>
				<a class="btn quiet icon sm" href="/dateien/{f.id}?download=1" aria-label="Herunterladen"><Download size={15} /></a>
				<form method="POST" action="?/datei_loeschen" use:enhance={submit({ confirm: `„${f.name}“ löschen?` })}>
					<input type="hidden" name="id" value={f.id} />
					<button class="btn quiet icon sm" type="submit" aria-label="Löschen"><Trash2 size={15} /></button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.drop {
		display: grid;
		justify-items: center;
		gap: 0.3rem;
		padding: 1.3rem 1rem;
		border: 1.5px dashed var(--line);
		border-radius: 16px;
		color: var(--dust);
		text-align: center;
		cursor: pointer;
		transition:
			border-color 0.25s,
			background-color 0.25s,
			transform 0.25s var(--ease-spring);
	}

	.drop:hover,
	.drop.hover {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--star);
	}

	.drop.hover {
		transform: scale(1.01);
	}

	.drop small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.files {
		margin-top: 0.75rem;
	}

	.files li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 9px;
		background: var(--nebula-soft);
		color: var(--nebula);
		flex: none;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.9rem;
		text-decoration: none;
	}

	.name:hover {
		color: var(--accent);
	}

	.meta {
		color: var(--dust-2);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	@media (max-width: 560px) {
		.meta {
			display: none;
		}
	}
</style>
