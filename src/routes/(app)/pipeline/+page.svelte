<script lang="ts">
	import { page } from '$app/state';
	import { Columns3, List, Plus } from '@lucide/svelte';
	import Board from '$lib/components/Board.svelte';
	import NewProject from '$lib/components/NewProject.svelte';
	import { moneyShort, relative } from '$lib/shared/format';
	import { STAGES, kindLabel, stageOf } from '$lib/shared/stages';

	let { data } = $props();
	let creating = $state(false);
	const view = $derived(page.url.searchParams.get('ansicht') === 'liste' ? 'liste' : 'board');
	const openValue = $derived(data.projects.filter((p) => !['abgeschlossen', 'verloren'].includes(p.stage)).reduce((s, p) => s + (p.valueCents ?? 0), 0));
</script>

<svelte:head><title>Pipeline – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Pipeline</h1>
			<p class="lead">Von der Anfrage bis zum Abschluss. Karten ziehen, um die Phase zu ändern{openValue ? ` · offen ${moneyShort(openValue)}` : ''}.</p>
		</div>
		<div class="actions">
			<div class="toggle" role="tablist" aria-label="Ansicht">
				<a href="?ansicht=board" class:on={view === 'board'} role="tab" aria-selected={view === 'board'}><Columns3 size={16} /> Board</a>
				<a href="?ansicht=liste" class:on={view === 'liste'} role="tab" aria-selected={view === 'liste'}><List size={16} /> Liste</a>
			</div>
			<button class="btn" type="button" onclick={() => (creating = true)}><Plus size={16} /> Projekt</button>
		</div>
	</div>

	{#if view === 'board'}
		<Board cards={data.projects} />
	{:else}
		<div class="card flush">
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr><th>Phase</th><th>Projekt</th><th>Kunde</th><th>Art</th><th class="right">Wert</th><th>Seit</th></tr>
					</thead>
					<tbody class="stagger">
						{#each [...data.projects].sort((a, b) => STAGES.findIndex((s) => s.id === a.stage) - STAGES.findIndex((s) => s.id === b.stage) || a.position - b.position) as p, i (p.id)}
							<tr style="--i: {i}">
								<td><span class="badge dot" style="--c: {stageOf(p.stage).color}">{stageOf(p.stage).label}</span></td>
								<td><a class="rowlink" href="/projekte/{p.id}">{p.title}</a></td>
								<td><a class="rowlink muted" href="/kunden/{p.customerId}">{p.customer}</a></td>
								<td class="muted">{kindLabel(p.kind)}</td>
								<td class="right num">{p.valueCents ? moneyShort(p.valueCents) : '–'}</td>
								<td class="muted small">{relative(p.stageChangedAt)}</td>
							</tr>
						{:else}
							<tr><td colspan="6" class="empty">Noch keine Projekte.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<NewProject bind:open={creating} customers={data.customers} />

<style>
	.page {
		max-width: none;
	}

	.toggle {
		display: inline-flex;
		padding: 0.2rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
	}

	.toggle a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		color: var(--dust);
		font-size: 0.85rem;
		text-decoration: none;
		transition:
			background-color 0.25s,
			color 0.25s;
	}

	.toggle a.on {
		background: var(--nebula-soft);
		color: var(--star);
	}
</style>
