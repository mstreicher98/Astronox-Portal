<script lang="ts">
	import { page } from '$app/state';
	import { CalendarClock, Clock, ExternalLink, FolderKanban, ListChecks, Plus, Search } from '@lucide/svelte';
	import NewProject from '$lib/components/NewProject.svelte';
	import { duration, moneyShort, relative, today } from '$lib/shared/format';
	import { kindLabel, stageOf, stageIndex } from '$lib/shared/stages';
	import { glow } from '$lib/ui/actions';

	let { data } = $props();
	let creating = $state(page.url.searchParams.has('neu'));
	let q = $state('');

	const filters = [
		['offen', 'Offen'],
		['aktiv', 'In Arbeit'],
		['abgeschlossen', 'Abgeschlossen'],
		['archiv', 'Archiv'],
		['alle', 'Alle']
	];
	const shown = $derived(data.projects.filter((p) => !q || `${p.title} ${p.customer}`.toLowerCase().includes(q.toLowerCase())));
	const day = today();
</script>

<svelte:head><title>Projekte – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Projekte</h1>
			<p class="lead">{data.projects.length} {data.filter === 'alle' ? 'insgesamt' : 'in dieser Ansicht'}</p>
		</div>
		<div class="actions">
			<button class="btn" type="button" onclick={() => (creating = true)}><Plus size={16} /> Projekt</button>
		</div>
	</div>

	<div class="row wrap bar">
		<nav class="tabs-inline">
			{#each filters as [id, label] (id)}
				<a href="?filter={id}" class:on={data.filter === id}>{label}</a>
			{/each}
		</nav>
		<label class="search">
			<Search size={16} />
			<input bind:value={q} placeholder="Projekt oder Kunde filtern" />
		</label>
	</div>

	{#if shown.length}
		<div class="grid-3 stagger">
			{#each shown as p, i (p.id)}
				{@const st = stageOf(p.stage)}
				{@const total = p.tasksOpen + p.tasksDone}
				<a class="card proj" href="/projekte/{p.id}" use:glow style="--i: {i}; --c: {st.color}">
					<div class="spread">
						<span class="badge dot" style="--c: {st.color}">{st.label}</span>
						{#if p.valueCents}<span class="num value">{moneyShort(p.valueCents)}</span>{/if}
					</div>
					<h2>{p.title}</h2>
					<p class="small muted">{p.customer} · {kindLabel(p.kind)}</p>
					<!-- Fortschritt entlang der Phasen -->
					<div class="track" aria-hidden="true">
						{#each { length: 7 } as _, s (s)}<i class:done={s <= stageIndex(p.stage) && p.stage !== 'verloren'}></i>{/each}
					</div>
					<div class="foot">
						{#if total}<span><ListChecks size={13} /> {p.tasksDone}/{total}</span>{/if}
						{#if p.minutes}<span><Clock size={13} /> {duration(p.minutes)}</span>{/if}
						{#if p.dueDate}<span class:late={p.dueDate < day && !['abgeschlossen', 'verloren'].includes(p.stage)}><CalendarClock size={13} /> {relative(p.dueDate)}</span>{/if}
						{#if p.liveUrl}<span><ExternalLink size={13} /> online</span>{/if}
						<span class="upd">{relative(p.updatedAt)}</span>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<div class="card empty">
			<FolderKanban size={30} />
			<p>Keine Projekte {q ? 'zu diesem Suchbegriff' : 'in dieser Ansicht'}.</p>
			<button class="btn ghost sm" type="button" onclick={() => (creating = true)}><Plus size={15} /> Projekt anlegen</button>
		</div>
	{/if}
</div>

<NewProject bind:open={creating} customers={data.customers} />

<style>
	.bar {
		justify-content: space-between;
	}

	.tabs-inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.2rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.45);
	}

	.tabs-inline a {
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		color: var(--dust);
		font-size: 0.85rem;
		text-decoration: none;
		transition:
			background-color 0.25s,
			color 0.25s;
	}

	.tabs-inline a.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: min(18rem, 100%);
		padding: 0 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
		color: var(--dust-2);
	}

	.search input {
		flex: 1;
		min-width: 0;
		height: 2.3rem;
		border: 0;
		background: transparent;
		outline: none;
		font-size: 0.88rem;
	}

	.proj {
		display: grid;
		gap: 0.45rem;
	}

	.proj h2 {
		margin-top: 0.3rem;
		font-family: var(--font-body);
		font-stretch: 100%;
		font-size: 1.02rem;
		font-weight: 650;
		letter-spacing: 0;
		line-height: 1.3;
	}

	.value {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.track {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		margin-top: 0.3rem;
	}

	.track i {
		height: 4px;
		border-radius: 2px;
		background: rgb(39 50 95 / 0.6);
	}

	.track i.done {
		background: var(--c);
		box-shadow: 0 0 8px -1px var(--c);
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.8rem;
		margin-top: 0.2rem;
		color: var(--dust-2);
		font-size: 0.76rem;
	}

	.foot span {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.foot .late {
		color: var(--danger);
	}

	.upd {
		margin-left: auto;
	}
</style>
