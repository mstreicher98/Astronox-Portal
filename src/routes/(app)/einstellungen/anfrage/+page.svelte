<script lang="ts">
	import { enhance } from '$app/forms';
	import { MessageSquareText } from '@lucide/svelte';
	import ItemList from '$lib/components/ItemList.svelte';
	import type { AnfrageSettings, Choice } from '$lib/shared/settings';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import { onServerChange } from '$lib/ui/sync.svelte';

	let { data } = $props();
	const fresh = (): AnfrageSettings => structuredClone(data.anfrage);
	let v = $state(fresh());
	onServerChange(() => data.anfrage, () => (v = fresh()));
	const blank = (): Choice => ({ id: '', label: '', hint: '' });
</script>

<svelte:head><title>Projektanfrage – Einstellungen</title></svelte:head>

<form method="POST" class="stack" use:enhance={submit()}>
	<input type="hidden" name="value" value={JSON.stringify(v)} />
	<div class="card stack" use:glow>
		<h2><MessageSquareText size={17} /> Auswahl im Anfrageformular</h2>
		<p class="small muted">Die drei ersten Schritte der Projektanfrage auf astronox.dev. Die Bezeichnungen stehen auch in der Pipeline beim Projekt.</p>
	</div>

	<div class="card stack" use:glow>
		<h3>1 · Projektart</h3>
		<ItemList bind:items={v.projectTypes} create={blank} addLabel="Projektart" title={(c: Choice) => c.label}>
			{#snippet item(c: Choice)}
				<div class="form-grid">
					<label class="field"><span>Bezeichnung</span><input bind:value={c.label} /></label>
					<label class="field"><span>Hinweis darunter</span><input bind:value={c.hint} /></label>
				</div>
			{/snippet}
		</ItemList>
	</div>

	<div class="grid-2">
		<div class="card stack" use:glow>
			<h3>2 · Budget</h3>
			<ItemList bind:items={v.budgets} create={blank} addLabel="Budget" title={(c: Choice) => c.label}>
				{#snippet item(c: Choice)}
					<label class="field"><span>Bezeichnung</span><input bind:value={c.label} /></label>
				{/snippet}
			</ItemList>
		</div>
		<div class="card stack" use:glow>
			<h3>3 · Zeitrahmen</h3>
			<ItemList bind:items={v.timeframes} create={blank} addLabel="Zeitrahmen" title={(c: Choice) => c.label}>
				{#snippet item(c: Choice)}
					<label class="field"><span>Bezeichnung</span><input bind:value={c.label} /></label>
				{/snippet}
			</ItemList>
		</div>
	</div>
	<div class="form-actions"><button class="btn" type="submit">Speichern</button></div>
</form>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
