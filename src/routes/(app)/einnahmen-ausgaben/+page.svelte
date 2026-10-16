<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { ArrowDownLeft, ArrowUpRight, CalendarSync, Download, FileArchive, LaptopMinimal, LayoutDashboard, ListOrdered, Paperclip, Pause, Play, Plus, Search, TriangleAlert } from '@lucide/svelte';
	import Columns from '$lib/components/Columns.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { categoryOf, KZ_LABELS, type EntryKind } from '$lib/shared/ear';
	import { date, money, moneyShort } from '$lib/shared/format';
	import { intervalOf } from '$lib/shared/stages';
	import { countUp, glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import AssetForm from './AssetForm.svelte';
	import EntryForm from './EntryForm.svelte';
	import RecurringForm from './RecurringForm.svelte';

	let { data } = $props();
	type Row = (typeof data.rows)[number];

	const tabs = [
		{ id: 'uebersicht', label: 'Übersicht', icon: LayoutDashboard },
		{ id: 'buchungen', label: 'Buchungen', icon: ListOrdered },
		{ id: 'wiederkehrend', label: 'Wiederkehrend', icon: CalendarSync },
		{ id: 'anlagen', label: 'Anlagen', icon: LaptopMinimal }
	];
	const link = (p: { tab?: string; jahr?: string }) => `?tab=${p.tab ?? data.tab}&jahr=${p.jahr ?? data.year}`;

	/* ---------- Dialoge */
	let entryOpen = $state(false);
	let entryKind = $state<EntryKind>('ausgabe');
	let editing = $state<Row | null>(null);
	let recurringOpen = $state(false);
	let recurringItem = $state<(typeof data.recurring)[number] | undefined>();
	let assetOpen = $state(false);
	let assetItem = $state<(typeof data.assets)[number] | undefined>();
	// Zähler, damit Formulare beim erneuten Öffnen frisch starten
	let formKey = $state(0);

	function newEntry(kind: EntryKind) {
		editing = null;
		entryKind = kind;
		formKey++;
		entryOpen = true;
	}
	function openRow(r: Row) {
		if (r.source === 'rechnung') return goto(`/rechnungen/${r.id}`);
		if (r.source === 'afa') return goto(link({ tab: 'anlagen' }));
		editing = r;
		formKey++;
		entryOpen = true;
	}

	// Aus der Befehlspalette: ?neu=ausgabe bzw. ?neu=einnahme
	$effect(() => {
		const neu = page.url.searchParams.get('neu');
		if (neu === 'ausgabe' || neu === 'einnahme') untrack(() => newEntry(neu));
	});

	/* ---------- Buchungen filtern */
	let filter = $state<'alle' | 'einnahme' | 'ausgabe' | 'ohne'>('alle');
	let query = $state('');
	const shown = $derived(
		data.rows
			.filter((r) => filter === 'alle' || r.kind === filter || (filter === 'ohne' && r.source === 'buchung' && r.kind === 'ausgabe' && !r.receipt))
			.filter((r) => !query.trim() || `${r.description} ${r.party ?? ''} ${categoryOf(r.category).label}`.toLowerCase().includes(query.trim().toLowerCase()))
			.slice()
			.reverse()
	);

	const s = $derived(data.summary);
	const monShort = new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: 'UTC' });
	const months = (key: 'income' | 'expenses') =>
		s.months.map((m, i) => {
			const d = new Date(Date.UTC(Number(data.year), i, 1));
			return { label: new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d), short: monShort.format(d).replace('.', ''), value: m[key] };
		});
	const thisMonth = $derived(String(new Date().getFullYear()) === data.year ? new Date().getMonth() : -1);
</script>

<svelte:head><title>Einnahmen & Ausgaben – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Einnahmen & Ausgaben</h1>
			<p class="lead">Einnahmen-Ausgaben-Rechnung nach dem Tag der Zahlung. Bezahlte Rechnungen zählen automatisch.</p>
		</div>
		<div class="actions">
			<button class="btn ghost" type="button" onclick={() => newEntry('einnahme')}><ArrowDownLeft size={16} /> Einnahme</button>
			<button class="btn" type="button" onclick={() => newEntry('ausgabe')}><Plus size={16} /> Ausgabe</button>
		</div>
	</div>

	<div class="row wrap bar">
		<nav class="seg" aria-label="Bereiche">
			{#each tabs as t (t.id)}
				<a href={link({ tab: t.id })} class:on={data.tab === t.id} aria-current={data.tab === t.id ? 'page' : undefined}><t.icon size={15} /> {t.label}</a>
			{/each}
		</nav>
		<div class="row">
			<select class="input pill" aria-label="Jahr" value={data.year} onchange={(e) => goto(link({ jahr: (e.currentTarget as HTMLSelectElement).value }))}>
				{#each data.years as y (y)}<option value={y}>{y}</option>{/each}
			</select>
			<a class="btn ghost sm" href="/einnahmen-ausgaben/export?jahr={data.year}&format=csv" data-sveltekit-reload title="Alle Buchungen als Tabelle"><Download size={14} /> CSV</a>
			<a class="btn ghost sm" href="/einnahmen-ausgaben/export?jahr={data.year}&format=zip" data-sveltekit-reload title="Tabellen, Belege und Rechnungs-PDFs für die Steuerberatung"><FileArchive size={14} /> Alles (ZIP)</a>
		</div>
	</div>

	{#if data.tab === 'uebersicht'}
		<div class="grid-4 stagger">
			<div class="card" use:glow style="--i: 0">
				<p class="small muted">Einnahmen {data.year}</p>
				<p class="v num ok" use:countUp={{ value: s.income, format: (n) => money(Math.round(n)) }}>{money(0)}</p>
			</div>
			<div class="card" use:glow style="--i: 1">
				<p class="small muted">Ausgaben {data.year}</p>
				<p class="v num" use:countUp={{ value: s.expenses, format: (n) => money(Math.round(n)) }}>{money(0)}</p>
			</div>
			<div class="card" use:glow style="--i: 2">
				<p class="small muted">{s.profit >= 0 ? 'Gewinn' : 'Verlust'} {data.year}</p>
				<p class="v num" class:ok={s.profit > 0} class:bad={s.profit < 0} use:countUp={{ value: s.profit, format: (n) => money(Math.round(n)) }}>{money(0)}</p>
			</div>
			{#if s.missingReceipts}
				<a class="card warncard" use:glow style="--i: 3" href="?tab=buchungen&jahr={data.year}" onclick={() => (filter = 'ohne')}>
					<p class="small muted"><TriangleAlert size={13} /> Ohne Beleg</p>
					<p class="v num">{s.missingReceipts} <small>{s.missingReceipts === 1 ? 'Ausgabe' : 'Ausgaben'}</small></p>
				</a>
			{:else}
				<div class="card" use:glow style="--i: 3">
					<p class="small muted">{data.vat ? 'Vorsteuer' : 'Buchungen'} {data.year}</p>
					<p class="v num">{data.vat ? money(s.inputTax) : data.rows.length}</p>
				</div>
			{/if}
		</div>

		<div class="grid-2">
			<div class="card" use:glow>
				<div class="card-head"><h2><ArrowDownLeft size={16} /> Einnahmen je Monat</h2><span class="small faint">{data.vat ? 'netto' : 'brutto'}</span></div>
				<Columns label="Einnahmen je Monat" data={months('income')} format={(n) => moneyShort(n)} highlight={thisMonth} minMax={100_000} emptyText="Bezahlte Rechnungen und Einnahmen erscheinen hier." />
			</div>
			<div class="card" use:glow>
				<div class="card-head"><h2><ArrowUpRight size={16} /> Ausgaben je Monat</h2><span class="small faint">inkl. AfA im Dezember</span></div>
				<Columns label="Ausgaben je Monat" data={months('expenses')} format={(n) => moneyShort(n)} highlight={thisMonth} minMax={50_000} emptyText="Noch keine Ausgaben gebucht." />
			</div>
		</div>

		<div class="card flush" use:glow>
			<div class="card-head pad">
				<h2>Nach Kennzahl der E1a</h2>
				<a class="btn quiet sm" href="/einnahmen-ausgaben/export?jahr={data.year}&format=uebersicht" data-sveltekit-reload><Download size={14} /> Übersicht als CSV</a>
			</div>
			<div class="table-wrap">
				<table class="table kz">
					<thead><tr><th>KZ</th><th>Bezeichnung</th><th class="right">Betrag</th></tr></thead>
					<tbody>
						{#each s.byKz as k (k.kz)}
							<tr class="group">
								<td class="mono">{k.kz}</td>
								<td>{KZ_LABELS[k.kz] ?? ''} <span class="badge {k.kind === 'einnahme' ? 'ok' : 'muted'}">{k.kind === 'einnahme' ? 'Einnahmen' : 'Ausgaben'}</span></td>
								<td class="right num">{money(k.cents)}</td>
							</tr>
							{#if k.categories.length > 1}
								{#each k.categories as c (c.id)}
									<tr class="sub"><td></td><td>{c.label}</td><td class="right num">{money(c.cents)}</td></tr>
								{/each}
							{/if}
						{:else}
							<tr><td colspan="3" class="muted">Noch nichts gebucht in {data.year}.</td></tr>
						{/each}
					</tbody>
					{#if s.byKz.length}
						<tfoot>
							<tr><td></td><td>Summe Einnahmen</td><td class="right num">{money(s.income)}</td></tr>
							<tr><td></td><td>Summe Ausgaben</td><td class="right num">{money(s.expenses)}</td></tr>
							<tr class="total"><td></td><td>{s.profit >= 0 ? 'Gewinn' : 'Verlust'}</td><td class="right num" class:ok={s.profit > 0} class:bad={s.profit < 0}>{money(s.profit)}</td></tr>
							{#if data.vat}<tr><td></td><td class="muted">USt aus Einnahmen · Vorsteuer aus Ausgaben</td><td class="right num muted">{money(s.outputTax)} · {money(s.inputTax)}</td></tr>{/if}
						</tfoot>
					{/if}
				</table>
			</div>
			<p class="small faint pad">Kennzahlen laut Beilage E 1a 2025 – sie ändern sich gelegentlich, daher jedes Jahr mit dem aktuellen Formular bzw. der Steuerberatung abgleichen.</p>
		</div>
	{:else if data.tab === 'buchungen'}
		<div class="row wrap bar">
			<div class="row wrap">
				{#each [['alle', 'Alle'], ['einnahme', 'Einnahmen'], ['ausgabe', 'Ausgaben'], ['ohne', 'Ohne Beleg']] as [id, label] (id)}
					<button type="button" class="chip filter" class:on={filter === id} onclick={() => (filter = id as typeof filter)}>{label}</button>
				{/each}
			</div>
			<label class="search"><Search size={15} /><input class="input" type="search" bind:value={query} placeholder="Suchen …" aria-label="Buchungen durchsuchen" /></label>
		</div>
		<div class="card flush">
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th aria-label="Beleg"></th><th class="right">Betrag</th></tr></thead>
					<tbody>
						{#each shown as r (r.key)}
							{@const c = categoryOf(r.category)}
							<tr class="click" onclick={() => openRow(r)}>
								<td class="small nowrap">{date(r.date)}</td>
								<td>
									<button class="linkish" type="button" onclick={(e) => (e.stopPropagation(), openRow(r))}>{r.description}</button>
									<small class="muted block">{[r.party, r.recurring ? 'wiederkehrend' : '', r.source === 'rechnung' ? 'aus Rechnung' : '', r.source === 'afa' ? 'aus Anlagenverzeichnis' : ''].filter(Boolean).join(' · ')}</small>
								</td>
								<td class="small">{c.label} <span class="faint mono">{c.kz}</span></td>
								<td>
									{#if r.source === 'buchung' && r.receipt}
										<a class="icon-link" href="/einnahmen-ausgaben/beleg/buchung/{r.id}" target="_blank" rel="noopener" title="Beleg ansehen" aria-label="Beleg ansehen" onclick={(e) => e.stopPropagation()}><Paperclip size={15} /></a>
									{:else if r.source === 'buchung' && r.kind === 'ausgabe'}
										<span class="missing" title="Beleg fehlt"><TriangleAlert size={14} /></span>
									{/if}
								</td>
								<td class="right num nowrap" class:ok={r.kind === 'einnahme'}>{r.kind === 'einnahme' ? '+' : '−'} {money(r.grossCents)}</td>
							</tr>
						{:else}
							<tr><td colspan="5" class="muted">{data.rows.length ? 'Nichts gefunden.' : `Noch keine Buchungen in ${data.year}.`}</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else if data.tab === 'wiederkehrend'}
		<div class="card flush">
			<div class="card-head pad">
				<h2><CalendarSync size={16} /> Wiederkehrende Ausgaben</h2>
				<div class="row">
					<form method="POST" action="?/jetzt_buchen" use:enhance={submit()}><button class="btn quiet sm" type="submit">Fällige jetzt buchen</button></form>
					<button
						class="btn ghost sm"
						type="button"
						onclick={() => {
							recurringItem = undefined;
							formKey++;
							recurringOpen = true;
						}}><Plus size={14} /> Wiederkehrend</button
					>
				</div>
			</div>
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Beschreibung</th><th>Kategorie</th><th class="right">Betrag</th><th>Wie oft</th><th>Nächste Buchung</th><th></th></tr></thead>
					<tbody>
						{#each data.recurring as r (r.id)}
							<tr class:off={!r.active}>
								<td>
									<button
										class="linkish"
										type="button"
										onclick={() => {
											recurringItem = r;
											formKey++;
											recurringOpen = true;
										}}>{r.description}</button
									>
									{#if r.party}<small class="muted block">{r.party}</small>{/if}
								</td>
								<td class="small">{categoryOf(r.category).label}</td>
								<td class="right num">{money(r.grossCents)}</td>
								<td class="small">{intervalOf(r.interval).label}</td>
								<td class="small">{r.active ? date(r.nextDate) : r.endDate && r.nextDate > r.endDate ? 'beendet' : 'pausiert'}{r.endDate && r.active ? ` · bis ${date(r.endDate)}` : ''}</td>
								<td class="right nowrap">
									<form method="POST" action="?/wiederkehrend_aktiv" class="inline" use:enhance={submit()}>
										<input type="hidden" name="id" value={r.id} />
										<button class="btn quiet icon sm" type="submit" title={r.active ? 'Pausieren' : 'Fortsetzen'} aria-label={r.active ? 'Pausieren' : 'Fortsetzen'}>{#if r.active}<Pause size={14} />{:else}<Play size={14} />{/if}</button>
									</form>
								</td>
							</tr>
						{:else}
							<tr><td colspan="6" class="muted">Noch keine. Typisch: Server, Domains, Software-Abos, Versicherung, SVS-Vorauszahlung.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<div class="card flush">
			<div class="card-head pad">
				<h2><LaptopMinimal size={16} /> Anlagenverzeichnis</h2>
				<button
					class="btn ghost sm"
					type="button"
					onclick={() => {
						assetItem = undefined;
						formKey++;
						assetOpen = true;
					}}><Plus size={14} /> Anlage</button
				>
			</div>
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Bezeichnung</th><th>In Betrieb seit</th><th class="right">Anschaffung</th><th>Nutzungsdauer</th><th class="right">AfA {data.year}</th><th class="right">Restbuchwert</th><th aria-label="Beleg"></th></tr></thead>
					<tbody>
						{#each data.assets as a (a.id)}
							<tr
								class="click"
								class:off={!!a.disposedOn && a.disposedOn.slice(0, 4) < data.year}
								onclick={() => {
									assetItem = a;
									formKey++;
									assetOpen = true;
								}}
							>
								<td><strong>{a.name}</strong>{#if a.disposedOn}<small class="muted block">ausgeschieden {date(a.disposedOn)}</small>{/if}</td>
								<td class="small">{date(a.startDate)}</td>
								<td class="right num">{money(a.costCents)}</td>
								<td class="small">{a.years} {a.years === 1 ? 'Jahr' : 'Jahre'}</td>
								<td class="right num">{a.afaYear ? money(a.afaYear) : '–'}</td>
								<td class="right num">{money(a.bookValue)}</td>
								<td>{#if a.receiptFile}<a class="icon-link" href="/einnahmen-ausgaben/beleg/anlage/{a.id}" target="_blank" rel="noopener" aria-label="Beleg ansehen" onclick={(e) => e.stopPropagation()}><Paperclip size={15} /></a>{/if}</td>
							</tr>
						{:else}
							<tr><td colspan="7" class="muted">Anschaffungen über 1.000 € (z. B. Laptop) kommen hierher und werden über die Nutzungsdauer abgeschrieben.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<Modal bind:open={entryOpen} title={editing ? (editing.kind === 'einnahme' ? 'Einnahme bearbeiten' : 'Ausgabe bearbeiten') : entryKind === 'einnahme' ? 'Neue Einnahme' : 'Neue Ausgabe'} wide>
	{#key formKey}
		<EntryForm entry={editing && editing.source === 'buchung' ? editing : undefined} kind={entryKind} vat={data.vat} ondone={() => (entryOpen = false)} />
	{/key}
</Modal>

<Modal bind:open={recurringOpen} title={recurringItem ? 'Wiederkehrende Ausgabe' : 'Neue wiederkehrende Ausgabe'} wide>
	{#key formKey}
		<RecurringForm item={recurringItem} ondone={() => (recurringOpen = false)} />
		{#if recurringItem}
			<form method="POST" action="?/wiederkehrend_loeschen" use:enhance={submit({ confirm: 'Wiederkehrende Ausgabe löschen?', confirmDetail: 'Bereits gebuchte Ausgaben bleiben erhalten.', done: () => (recurringOpen = false) })}>
				<input type="hidden" name="id" value={recurringItem.id} />
				<button class="btn quiet sm danger-text" type="submit">Löschen</button>
			</form>
		{/if}
	{/key}
</Modal>

<Modal bind:open={assetOpen} title={assetItem ? assetItem.name : 'Neue Anlage'} wide>
	{#key formKey}
		<AssetForm asset={assetItem} vat={data.vat} ondone={() => (assetOpen = false)} />
	{/key}
</Modal>

<style>
	.bar {
		justify-content: space-between;
	}

	.seg {
		display: inline-flex;
		flex-wrap: wrap;
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

	.v small {
		color: var(--dust-2);
		font-family: var(--font-body);
		font-size: 0.85rem;
		font-weight: 400;
	}

	.ok {
		color: var(--ok);
	}

	.bad {
		color: var(--danger);
	}

	.warncard {
		border-color: rgb(var(--warn-rgb, 251 191 36) / 0.4);
		text-decoration: none;
		color: inherit;
	}

	.warncard p:first-child {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--warn);
	}

	.pad {
		padding: 1rem 1.2rem 0;
	}

	p.pad {
		padding-bottom: 1rem;
	}

	.kz .group td {
		font-weight: 600;
	}

	.kz .sub td {
		padding-top: 0.25rem;
		padding-bottom: 0.25rem;
		color: var(--dust);
		font-size: 0.85rem;
	}

	.kz .sub td:nth-child(2) {
		padding-left: 1.5rem;
	}

	.kz tfoot td {
		border-top: 1px solid var(--line-soft);
	}

	.kz .total td {
		font-weight: 700;
		font-size: 1.05rem;
	}

	.badge {
		margin-left: 0.35rem;
		font-weight: 500;
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

	.search {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: var(--dust-2);
	}

	.search .input {
		width: min(16rem, 60vw);
	}

	.click {
		cursor: pointer;
	}

	.linkish {
		padding: 0;
		border: 0;
		background: none;
		color: var(--star);
		font: inherit;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}

	.linkish:hover {
		color: var(--accent);
	}

	.block {
		display: block;
	}

	.nowrap {
		white-space: nowrap;
	}

	.icon-link {
		display: inline-grid;
		color: var(--dust);
	}

	.icon-link:hover {
		color: var(--accent);
	}

	.missing {
		display: inline-grid;
		color: var(--warn);
	}

	.off {
		opacity: 0.5;
	}

	.inline {
		display: inline;
	}

	.danger-text {
		margin-top: 0.5rem;
		color: var(--danger);
	}
</style>
