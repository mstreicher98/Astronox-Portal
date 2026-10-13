<script lang="ts" generics="T">
	import { ArrowDown, ArrowUp, Plus, Trash2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';

	/** Liste gleichartiger Einträge mit Hinzufügen, Sortieren und Entfernen */
	let {
		items = $bindable(),
		create,
		addLabel = 'Eintrag',
		fixed = false,
		title,
		item
	}: { items: T[]; create?: () => T; addLabel?: string; fixed?: boolean; title: (it: T, i: number) => string; item: Snippet<[T, number]> } = $props();

	// stabile Schlüssel für die Animation
	let keys = $state<number[]>([]);
	let next = 0;
	$effect.pre(() => {
		while (keys.length < items.length) keys.push(next++);
		if (keys.length > items.length) keys.length = items.length;
	});

	function move(i: number, d: -1 | 1) {
		const j = i + d;
		if (j < 0 || j >= items.length) return;
		[items[i], items[j]] = [items[j], items[i]];
		[keys[i], keys[j]] = [keys[j], keys[i]];
	}

	function remove(i: number) {
		items.splice(i, 1);
		keys.splice(i, 1);
	}
</script>

<div class="items">
	{#each items as it, i (keys[i] ?? i)}
		<details class="entry" animate:flip={{ duration: 260 }} in:fly={{ y: 10, duration: 260 }} open={items.length <= 3}>
			<summary>
				<span class="n">{i + 1}</span>
				<strong>{title(it, i) || 'Ohne Titel'}</strong>
				{#if !fixed}
					<span class="tools">
						<button class="btn quiet icon sm" type="button" aria-label="Nach oben" onclick={(e) => (e.preventDefault(), move(i, -1))}><ArrowUp size={13} /></button>
						<button class="btn quiet icon sm" type="button" aria-label="Nach unten" onclick={(e) => (e.preventDefault(), move(i, 1))}><ArrowDown size={13} /></button>
						<button class="btn quiet icon sm" type="button" aria-label="Entfernen" onclick={(e) => (e.preventDefault(), remove(i))}><Trash2 size={13} /></button>
					</span>
				{/if}
			</summary>
			<div class="body">{@render item(it, i)}</div>
		</details>
	{/each}
	{#if create && !fixed}
		<button class="btn ghost sm add" type="button" onclick={() => items.push(create!())}><Plus size={14} /> {addLabel}</button>
	{/if}
</div>

<style>
	.items {
		display: grid;
		gap: 0.5rem;
	}

	.entry {
		border: 1px solid var(--line-soft);
		border-radius: 14px;
		background: rgb(7 13 36 / 0.35);
	}

	.entry[open] {
		border-color: var(--line);
	}

	summary {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		cursor: pointer;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.n {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: var(--nebula-soft);
		color: var(--nebula);
		font-size: 0.72rem;
		font-weight: 700;
	}

	summary strong {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tools {
		display: flex;
	}

	.body {
		display: grid;
		gap: 0.75rem;
		padding: 0.2rem 0.9rem 0.9rem;
	}

	.add {
		justify-self: start;
	}
</style>
