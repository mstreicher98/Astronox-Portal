<script lang="ts">
	import { Eye, MessageSquarePlus, ShieldCheck, TrendingDown, TrendingUp } from '@lucide/svelte';
	import AreaLine from '$lib/components/AreaLine.svelte';
	import { date, number } from '$lib/shared/format';
	import { countUp, glow } from '$lib/ui/actions';

	let { data } = $props();
	const delta = $derived(data.previous ? Math.round(((data.total - data.previous) / data.previous) * 100) : null);
	const maxPage = $derived(Math.max(1, ...data.pages.map((p) => p.n)));
	const conversion = $derived(data.total ? ((data.inquiries + data.bookings) / data.total) * 100 : 0);
	const label = (p: string) => (p === '/' ? 'Startseite' : p === '/impressum' ? 'Impressum' : p === '/datenschutz' ? 'Datenschutz' : p);
</script>

<svelte:head><title>Besucherstatistik – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<div class="crumbs"><a href="/webseite">Webseite</a> / Statistik</div>
			<h1>Besucherstatistik</h1>
			<p class="lead row"><ShieldCheck size={15} /> Ohne Cookies gezählt: nur Seitenaufrufe je Tag und Seite, keine Personen.</p>
		</div>
		<nav class="seg">
			{#each [30, 90, 365] as d (d)}<a href="?tage={d}" class:on={data.days === d}>{d} Tage</a>{/each}
		</nav>
	</div>

	<div class="grid-3 stagger">
		<div class="card" use:glow style="--i: 0">
			<p class="small muted"><Eye size={14} /> Aufrufe</p>
			<p class="v num" use:countUp={{ value: data.total, format: (n) => number(Math.round(n)) }}>0</p>
			{#if delta != null}
				<p class="small" class:up={delta >= 0} class:down={delta < 0}>
					{#if delta >= 0}<TrendingUp size={14} />{:else}<TrendingDown size={14} />{/if}
					{delta > 0 ? '+' : ''}{delta} % zum Zeitraum davor
				</p>
			{/if}
		</div>
		<div class="card" use:glow style="--i: 1">
			<p class="small muted"><MessageSquarePlus size={14} /> Anfragen & Buchungen</p>
			<p class="v num">{data.inquiries + data.bookings}</p>
			<p class="small faint">{data.inquiries} Anfragen · {data.bookings} Termine</p>
		</div>
		<div class="card" use:glow style="--i: 2">
			<p class="small muted">Kontakt je Aufruf</p>
			<p class="v num">{number(Math.round(conversion * 100) / 100)} %</p>
			<p class="small faint">grober Richtwert</p>
		</div>
	</div>

	<div class="card" use:glow>
		<div class="card-head"><h2>Aufrufe je Tag</h2></div>
		<AreaLine label="Seitenaufrufe je Tag" data={data.series.map((s) => ({ label: date(s.day), value: s.value }))} format={(n) => `${number(n)} Aufrufe`} height={220} />
	</div>

	<div class="card" use:glow>
		<div class="card-head"><h2>Seiten</h2></div>
		{#if data.pages.length}
			<ul class="bars">
				{#each data.pages as p, i (p.path)}
					<li style="--w: {(p.n / maxPage) * 100}%; --i: {i}">
						<span class="name">{label(p.path)}</span>
						<span class="track"><i></i></span>
						<span class="num">{number(p.n)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="small muted">Noch keine Aufrufe gezählt.</p>
		{/if}
	</div>
</div>

<style>
	.seg {
		display: inline-flex;
		padding: 0.2rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.45);
	}

	.seg a {
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		color: var(--dust);
		font-size: 0.85rem;
		text-decoration: none;
	}

	.seg a.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	.card p {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.v {
		margin: 0.3rem 0 0.2rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.7rem;
	}

	.up {
		color: var(--ok);
	}

	.down {
		color: var(--danger);
	}

	.bars {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.bars li {
		display: grid;
		grid-template-columns: 10rem minmax(0, 1fr) 4rem;
		align-items: center;
		gap: 0.8rem;
		font-size: 0.88rem;
	}

	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--dust);
	}

	.track {
		height: 0.55rem;
		border-radius: 999px;
		background: rgb(39 50 95 / 0.5);
		overflow: hidden;
	}

	.track i {
		display: block;
		width: var(--w);
		height: 100%;
		border-radius: 999px;
		background: var(--nebula);
		transform-origin: left;
		animation: grow 0.9s var(--ease-out) both;
		animation-delay: calc(var(--i) * 50ms);
	}

	.bars .num {
		text-align: right;
	}
</style>
