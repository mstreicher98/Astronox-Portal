<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import Modal from './Modal.svelte';
	import { relative } from '$lib/shared/format';
	import { api, submit } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	/** Zugänge (Hosting, CMS, Domain-Registrar …) – verschlüsselt gespeichert, Anzeige nur auf Klick */
	type C = { id: number; label: string; url: string | null; username: string | null; hasSecret: boolean; hasNotes: boolean; updatedAt: string };
	let { credentials }: { credentials: C[] } = $props();

	let revealed = $state<Record<number, { secret: string; notes: string }>>({});
	let editing = $state<C | null>(null);
	let open = $state(false);

	async function reveal(c: C) {
		if (revealed[c.id]) {
			delete revealed[c.id];
			return;
		}
		revealed[c.id] = await api(`/api/zugang/${c.id}`);
		// nach einer Minute wieder verbergen
		setTimeout(() => delete revealed[c.id], 60_000);
	}

	async function copy(c: C, what: 'user' | 'secret') {
		const text = what === 'user' ? (c.username ?? '') : (revealed[c.id]?.secret ?? (await api<{ secret: string }>(`/api/zugang/${c.id}`)).secret);
		await navigator.clipboard.writeText(text);
		toast(what === 'user' ? 'Benutzername kopiert' : 'Passwort kopiert');
	}

	function edit(c: C | null) {
		editing = c;
		open = true;
	}
</script>

<div class="spread head">
	<p class="small muted">Verschlüsselt gespeichert, angezeigt nur auf Klick.</p>
	<button class="btn ghost sm" type="button" onclick={() => edit(null)}><Plus size={15} /> Zugang</button>
</div>

{#if credentials.length}
	<ul class="list creds">
		{#each credentials as c (c.id)}
			<li>
				<div class="main">
					<span class="ico"><KeyRound size={16} /></span>
					<div class="txt">
						<strong>{c.label}</strong>
						<small>
							{#if c.url}<a href={c.url} target="_blank" rel="noopener noreferrer">{c.url.replace(/^https?:\/\//, '')} <ExternalLink size={11} /></a>{/if}
							{#if c.username}<button type="button" class="link" onclick={() => copy(c, 'user')} title="Kopieren">{c.username}</button>{/if}
						</small>
					</div>
					<div class="row">
						{#if c.hasSecret}
							<button class="btn quiet icon sm" type="button" aria-label="Passwort kopieren" onclick={() => copy(c, 'secret')}><Copy size={15} /></button>
						{/if}
						{#if c.hasSecret || c.hasNotes}
							<button class="btn quiet icon sm" type="button" aria-label="Anzeigen" onclick={() => reveal(c)}>
								{#if revealed[c.id]}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
							</button>
						{/if}
						<button class="btn quiet icon sm" type="button" aria-label="Bearbeiten" onclick={() => edit(c)}><Pencil size={15} /></button>
					</div>
				</div>
				{#if revealed[c.id]}
					<div class="secret" transition:slide={{ duration: 220 }}>
						{#if revealed[c.id].secret}<code class="mono">{revealed[c.id].secret}</code>{/if}
						{#if revealed[c.id].notes}<p class="prewrap small">{revealed[c.id].notes}</p>{/if}
						<small class="faint">geändert {relative(c.updatedAt)}</small>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty small">Noch keine Zugänge hinterlegt.</p>
{/if}

<Modal bind:open title={editing ? 'Zugang bearbeiten' : 'Neuer Zugang'}>
	<form method="POST" action="?/zugang" class="stack" use:enhance={submit({ done: () => (open = false) })}>
		{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
		<label class="field">
			<span>Bezeichnung</span>
			<input name="label" required value={editing?.label ?? ''} placeholder="z. B. Hosting-Panel, WordPress, Domain bei World4You" />
		</label>
		<label class="field">
			<span>Adresse</span>
			<input name="url" value={editing?.url ?? ''} placeholder="https://…" />
		</label>
		<div class="form-grid">
			<label class="field">
				<span>Benutzer</span>
				<input name="username" autocomplete="off" value={editing?.username ?? ''} />
			</label>
			<label class="field">
				<span>Passwort {#if editing?.hasSecret}<small>– leer lassen = unverändert</small>{/if}</span>
				<input name="secret" type="password" autocomplete="new-password" />
			</label>
		</div>
		<label class="field">
			<span>Notizen <small>(verschlüsselt{editing?.hasNotes ? ' – leer lassen = unverändert' : ''})</small></span>
			<textarea name="notes" rows="3" placeholder="z. B. 2FA-Hinweise, API-Schlüssel"></textarea>
		</label>
		<div class="form-actions">
			{#if editing}
				<button class="btn danger" type="submit" formaction="?/zugang_loeschen" formnovalidate><Trash2 size={15} /> Löschen</button>
			{/if}
			<button class="btn" type="submit">Speichern</button>
		</div>
	</form>
</Modal>

<style>
	.head {
		margin-bottom: 0.5rem;
	}

	.creds li {
		padding: 0.55rem 0;
	}

	.main {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.ico {
		display: grid;
		place-items: center;
		flex: none;
		width: 2rem;
		height: 2rem;
		border-radius: 9px;
		background: rgb(var(--warn-rgb) / 0.1);
		color: var(--warn);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: grid;
		line-height: 1.3;
	}

	.txt strong {
		font-size: 0.9rem;
		font-weight: 600;
	}

	.txt small {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 0.8rem;
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.txt a {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		text-decoration: none;
	}

	.txt a:hover,
	.link:hover {
		color: var(--accent);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: copy;
	}

	.secret {
		display: grid;
		gap: 0.35rem;
		margin: 0.5rem 0 0 2.7rem;
		padding: 0.6rem 0.75rem;
		border: 1px dashed rgb(var(--warn-rgb) / 0.35);
		border-radius: 10px;
		background: rgb(var(--warn-rgb) / 0.05);
	}

	code {
		color: var(--warn);
		word-break: break-all;
	}

	.empty {
		padding: 1rem 0;
	}
</style>
