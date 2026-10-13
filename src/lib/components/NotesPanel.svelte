<script lang="ts">
	import { enhance } from '$app/forms';
	import { NotebookPen, Phone, Send, Trash2 } from '@lucide/svelte';
	import Timeline from './Timeline.svelte';
	import { autosize } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	/** Notiz oder Telefonat festhalten, darunter der Verlauf */
	type Item = { id: number; kind: string; title: string; body: string | null; createdAt: string; project?: string | null; projectId?: number | null; customerId?: number | null; meta?: string | null };
	let { items, context = false }: { items: Item[]; context?: boolean } = $props();

	let kind = $state<'notiz' | 'anruf'>('notiz');
	let filter = $state<'alle' | 'notizen' | 'mails' | 'system'>('alle');

	const shown = $derived(
		items.filter((i) =>
			filter === 'alle'
				? true
				: filter === 'notizen'
					? i.kind === 'notiz' || i.kind === 'anruf'
					: filter === 'mails'
						? i.kind.startsWith('mail')
						: !['notiz', 'anruf', 'mail_ein', 'mail_aus'].includes(i.kind)
		)
	);
	const notes = $derived(items.filter((i) => i.kind === 'notiz' || i.kind === 'anruf'));
</script>

<div class="stack">
	<form method="POST" action="?/notiz" class="composer" use:enhance={submit({ reset: true })}>
		<input type="hidden" name="kind" value={kind} />
		<div class="row">
			<button type="button" class="pill" class:on={kind === 'notiz'} onclick={() => (kind = 'notiz')}><NotebookPen size={14} /> Notiz</button>
			<button type="button" class="pill" class:on={kind === 'anruf'} onclick={() => (kind = 'anruf')}><Phone size={14} /> Telefonat</button>
			{#if kind === 'anruf'}<input class="input title" name="title" placeholder="Mit wem? (optional)" />{/if}
		</div>
		<textarea class="input" name="body" rows="2" required use:autosize placeholder={kind === 'anruf' ? 'Was wurde besprochen?' : 'Notiz, Idee, Absprache …'}></textarea>
		<div class="form-actions">
			<button class="btn sm" type="submit"><Send size={14} /> Speichern</button>
		</div>
	</form>

	<div class="row wrap filters">
		{#each [['alle', 'Alles'], ['notizen', 'Notizen'], ['mails', 'E-Mails'], ['system', 'Ereignisse']] as [id, label] (id)}
			<button type="button" class="chip" class:on={filter === id} onclick={() => (filter = id as typeof filter)}>{label}</button>
		{/each}
	</div>

	<Timeline items={shown} {context} />

	{#if notes.length && filter === 'notizen'}
		<details class="manage small">
			<summary>Notizen löschen</summary>
			<ul class="list">
				{#each notes as n (n.id)}
					<li class="spread">
						<span class="muted">{n.title}: {n.body?.slice(0, 60)}</span>
						<form method="POST" action="?/notiz_loeschen" use:enhance={submit({ confirm: 'Diese Notiz löschen?' })}>
							<input type="hidden" name="id" value={n.id} />
							<button class="btn quiet icon sm" type="submit" aria-label="Löschen"><Trash2 size={14} /></button>
						</form>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<style>
	.composer {
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem;
		border: 1px solid var(--line-soft);
		border-radius: 14px;
		background: rgb(7 13 36 / 0.35);
	}

	.composer textarea {
		min-height: 3.2rem;
		resize: none;
	}

	.pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: transparent;
		color: var(--dust);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.pill.on {
		border-color: rgb(var(--accent-rgb) / 0.5);
		background: var(--accent-soft);
		color: var(--star);
	}

	.title {
		flex: 1;
		min-height: 2rem !important;
		padding: 0.3rem 0.7rem !important;
	}

	.filters .chip {
		background: transparent;
		cursor: pointer;
	}

	.filters .chip.on {
		border-color: var(--nebula);
		color: var(--star);
		background: var(--nebula-soft);
	}

	.manage summary {
		cursor: pointer;
		color: var(--dust-2);
	}

	.manage li {
		padding: 0.3rem 0;
	}
</style>
