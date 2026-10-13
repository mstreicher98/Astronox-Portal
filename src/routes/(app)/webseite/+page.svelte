<script lang="ts">
	import { enhance } from '$app/forms';
	import { BarChart3, ExternalLink, FilePen, Rocket, Undo2 } from '@lucide/svelte';
	import SitePreview from '$lib/components/SitePreview.svelte';
	import { relative } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const drafts = $derived(data.sections.filter((s) => s.hasDraft).length);
	let version = $state(0);
</script>

<svelte:head><title>Webseite – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Webseite</h1>
			<p class="lead">Texte, Pakete, Referenzen und Rechtstexte von <a href={data.website} target="_blank" rel="noopener">{data.website.replace(/^https?:\/\//, '')} <ExternalLink size={12} /></a></p>
		</div>
		<div class="actions">
			<a class="btn ghost sm" href="/webseite/statistik"><BarChart3 size={15} /> Statistik</a>
			{#if drafts}
				<form method="POST" action="?/verwerfen" use:enhance={submit({ confirm: 'Alle Entwürfe verwerfen?' })}><button class="btn quiet sm" type="submit"><Undo2 size={15} /> Verwerfen</button></form>
				<form method="POST" action="?/veroeffentlichen" use:enhance={submit({ done: () => version++ })}><button class="btn sm" type="submit"><Rocket size={15} /> {drafts} Entwurf{drafts === 1 ? '' : 'e'} veröffentlichen</button></form>
			{/if}
		</div>
	</div>

	<div class="layout">
		<div class="sections stagger">
			{#each data.sections as s, i (s.key)}
				<a class="card sec" href="/webseite/{s.key}" use:glow style="--i: {i}" class:draft={s.hasDraft}>
					<span class="ico"><FilePen size={16} /></span>
					<span class="txt">
						<strong>{s.label}</strong>
						<small>{s.hint}</small>
					</span>
					{#if s.hasDraft}<span class="badge warn dot">Entwurf</span>{:else if s.publishedAt}<span class="small faint">{relative(s.publishedAt)}</span>{/if}
				</a>
			{/each}
		</div>
		<div class="card" use:glow>
			<SitePreview src={data.preview} {version} />
		</div>
	</div>
</div>

<style>
	.lead a {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--accent);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(16rem, 0.7fr) minmax(0, 1.3fr);
		gap: 1rem;
		align-items: start;
	}

	.sections {
		display: grid;
		gap: 0.5rem;
	}

	.sec {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.8rem 1rem;
	}

	.sec.draft {
		border-color: rgb(var(--warn-rgb) / 0.35);
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

	.txt {
		flex: 1;
		display: grid;
		line-height: 1.3;
		min-width: 0;
	}

	.txt strong {
		font-weight: 600;
		font-size: 0.92rem;
	}

	.txt small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	@media (max-width: 1000px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
