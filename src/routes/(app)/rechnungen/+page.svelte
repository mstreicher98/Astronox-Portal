<script lang="ts">
	import { Download, FileArchive, FileText, Plus, ReceiptText } from '@lucide/svelte';
	import { date, money, today } from '$lib/shared/format';
	import { DOC_STATUS } from '$lib/shared/stages';
	import { countUp, glow } from '$lib/ui/actions';

	let { data } = $props();
	let status = $state('alle');
	const isQuote = $derived(data.type === 'angebot');
	const day = today();

	const shown = $derived(data.documents.filter((d) => status === 'alle' || d.status === status || (status === 'ueberfaellig' && d.status === 'offen' && d.dueDate && d.dueDate < day)));
	const sum = (list: typeof data.documents, f: (d: (typeof data.documents)[number]) => boolean) => list.filter(f).reduce((s, d) => s + d.grossCents, 0);
	const kpis = $derived(
		isQuote
			? [
					{ label: 'Offen', value: sum(data.documents, (d) => d.status === 'offen') },
					{ label: 'Angenommen', value: sum(data.documents, (d) => d.status === 'angenommen') },
					{ label: 'Annahmequote', value: -1 }
				]
			: [
					{ label: 'Verrechnet', value: sum(data.documents, (d) => ['offen', 'bezahlt'].includes(d.status) && !d.cancelsId) },
					{ label: 'Bezahlt', value: sum(data.documents, (d) => d.status === 'bezahlt' && !d.cancelsId) },
					{ label: 'Offen', value: sum(data.documents, (d) => d.status === 'offen') }
				]
	);
	const decided = $derived(data.documents.filter((d) => ['angenommen', 'abgelehnt'].includes(d.status)));
	const rate = $derived(decided.length ? Math.round((decided.filter((d) => d.status === 'angenommen').length / decided.length) * 100) : 0);
	const statuses = $derived(isQuote ? ['alle', 'entwurf', 'offen', 'angenommen', 'abgelehnt'] : ['alle', 'entwurf', 'offen', 'ueberfaellig', 'bezahlt', 'storniert']);
</script>

<svelte:head><title>{isQuote ? 'Angebote' : 'Rechnungen'} – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Angebote & Rechnungen</h1>
			<p class="lead">Fortlaufend nummeriert, festgeschrieben als PDF.</p>
		</div>
		<div class="actions">
			<a class="btn ghost" href="/rechnungen/neu?typ=angebot"><FileText size={16} /> Angebot</a>
			<a class="btn" href="/rechnungen/neu?typ=rechnung"><Plus size={16} /> Rechnung</a>
		</div>
	</div>

	<div class="row wrap bar">
		<nav class="seg">
			<a href="?typ=rechnung&jahr={data.year}" class:on={!isQuote}><ReceiptText size={15} /> Rechnungen</a>
			<a href="?typ=angebot&jahr={data.year}" class:on={isQuote}><FileText size={15} /> Angebote</a>
		</nav>
		<div class="row">
			<select class="input pill" onchange={(e) => (location.href = `?typ=${data.type}&jahr=${(e.currentTarget as HTMLSelectElement).value}`)} aria-label="Jahr">
				{#each data.years as y (y)}<option value={y} selected={y === data.year}>{y}</option>{/each}
			</select>
			{#if !isQuote}
				<a class="btn ghost sm" href="/rechnungen/export?jahr={data.year}&format=csv" data-sveltekit-reload><Download size={14} /> CSV</a>
				<a class="btn ghost sm" href="/rechnungen/export?jahr={data.year}&format=zip" data-sveltekit-reload><FileArchive size={14} /> PDFs (ZIP)</a>
			{/if}
		</div>
	</div>

	<div class="grid-3 stagger">
		{#each kpis as k, i (k.label)}
			<div class="card" use:glow style="--i: {i}">
				<p class="small muted">{k.label} {data.year}</p>
				{#if k.value === -1}
					<p class="v num">{rate} %</p>
				{:else}
					<p class="v num" use:countUp={{ value: k.value, format: (n) => money(Math.round(n)) }}>{money(0)}</p>
				{/if}
			</div>
		{/each}
	</div>

	<div class="row wrap">
		{#each statuses as s (s)}
			<button type="button" class="chip filter" class:on={status === s} onclick={() => (status = s)}>{s === 'alle' ? 'Alle' : s === 'ueberfaellig' ? 'Überfällig' : DOC_STATUS[s].label}</button>
		{/each}
	</div>

	<div class="card flush">
		<div class="table-wrap">
			<table class="table">
				<thead><tr><th>Nummer</th><th>Kunde</th><th>Titel</th><th>Datum</th><th>{isQuote ? 'Gültig bis' : 'Fällig'}</th><th class="right">Betrag</th><th>Status</th></tr></thead>
				<tbody class="stagger">
					{#each shown as d, i (d.id)}
						{@const late = !isQuote && d.status === 'offen' && d.dueDate && d.dueDate < day}
						<tr style="--i: {i}">
							<td><a class="rowlink mono" href="/rechnungen/{d.id}">{d.number ?? 'Entwurf'}</a></td>
							<td>{d.customer}</td>
							<td class="muted">{d.cancelsId ? 'Storno · ' : ''}{d.title}</td>
							<td class="small">{date(d.issueDate)}</td>
							<td class="small" class:late>{d.dueDate ? date(d.dueDate) : '–'}</td>
							<td class="right num">{money(d.grossCents)}</td>
							<td>
								{#if late}<span class="badge danger dot">überfällig</span>{:else}<span class="badge {DOC_STATUS[d.status].tone}">{DOC_STATUS[d.status].label}</span>{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan="7" class="muted">Keine {isQuote ? 'Angebote' : 'Rechnungen'} in {data.year}.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<style>
	.bar {
		justify-content: space-between;
	}

	.seg {
		display: inline-flex;
		padding: 0.2rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.45);
	}

	.seg a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		color: var(--dust);
		font-size: 0.86rem;
		text-decoration: none;
	}

	.seg a.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	.pill {
		width: auto;
		min-height: 2rem;
		padding: 0.2rem 2rem 0.2rem 0.8rem;
		border-radius: 999px;
	}

	.v {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.5rem;
	}

	.filter {
		background: transparent;
		cursor: pointer;
	}

	.filter.on {
		border-color: var(--nebula);
		background: var(--nebula-soft);
		color: var(--star);
	}

	.late {
		color: var(--danger);
	}
</style>
