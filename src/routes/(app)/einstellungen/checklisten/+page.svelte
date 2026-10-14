<script lang="ts">
	import { enhance } from '$app/forms';
	import { ListChecks, Plus } from '@lucide/svelte';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	let newList = $state(false);
</script>

<svelte:head><title>Checklisten – Einstellungen</title></svelte:head>

<div class="card stack" use:glow>
	<div class="spread">
		<h2><ListChecks size={17} /> Checklisten für Projekte</h2>
		<button class="btn ghost sm" type="button" onclick={() => (newList = !newList)}><Plus size={14} /> Checkliste</button>
	</div>
	{#if newList}
		<form method="POST" action="?/liste" class="stack tpl" use:enhance={submit({ reset: true, done: () => (newList = false) })}>
			<label class="field"><span>Name</span><input name="name" required /></label>
			<label class="field"><span>Punkte <small>(einer pro Zeile)</small></span><textarea name="items" rows="8" required></textarea></label>
			<div class="form-actions"><button class="btn sm" type="submit">Anlegen</button></div>
		</form>
	{/if}
	{#each data.lists as l (l.id)}
		<details class="tpl">
			<summary><strong>{l.name}</strong> <span class="faint small">{l.items.length} Punkte</span></summary>
			<form method="POST" action="?/liste" class="stack" use:enhance={submit()}>
				<input type="hidden" name="id" value={l.id} />
				<label class="field"><span>Name</span><input name="name" required value={l.name} /></label>
				<label class="field"><span>Punkte <small>(einer pro Zeile)</small></span><textarea name="items" rows={Math.min(16, l.items.length + 2)}>{l.items.join('\n')}</textarea></label>
				<div class="form-actions">
					<button class="btn danger sm" type="submit" formaction="?/liste_loeschen">Löschen</button>
					<button class="btn sm" type="submit">Speichern</button>
				</div>
			</form>
		</details>
	{/each}
</div>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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
		gap: 0.6rem;
		cursor: pointer;
	}

	.tpl[open] summary {
		margin-bottom: 0.8rem;
	}
</style>
