<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarClock, FileSignature, Plus, ReceiptText, Send, Zap } from '@lucide/svelte';
	import ContractForm from '$lib/components/ContractForm.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { contractStatus, monthlyCents, STATUS_LABEL, type ContractStatus } from '$lib/shared/billing';
	import { date, money, relative } from '$lib/shared/format';
	import { CONTRACT_KINDS, contractKindOf, intervalOf } from '$lib/shared/stages';
	import { countUp, glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();

	type Row = (typeof data.contracts)[number];

	let kind = $state<'alle' | (typeof CONTRACT_KINDS)[number]['id']>('alle');
	let show = $state<'laufend' | 'alle' | 'beendet'>('laufend');
	let open = $state(false);
	let editing = $state<Row | null>(null);
	/** Formular bei jedem Öffnen neu aufbauen */
	let formKey = $state(0);

	const status = (c: Row): ContractStatus => contractStatus(c, data.today);
	const running = (s: ContractStatus) => s === 'aktiv' || s === 'gekuendigt' || s === 'geplant';

	const live = $derived(data.contracts.filter((c) => running(status(c))));
	const mrr = $derived(live.reduce((s, c) => s + monthlyCents(c.amountCents, intervalOf(c.interval).months), 0));
	const customersWith = $derived(new Set(live.map((c) => c.customerId)).size);
	const nextRun = $derived(data.upcoming[0]?.date ?? null);
	const nextRunSum = $derived(data.upcoming.filter((u) => u.date === nextRun).reduce((s, u) => s + u.netCents, 0));
	const byKind = $derived(CONTRACT_KINDS.map((k) => ({ ...k, n: live.filter((c) => c.kind === k.id).length })).filter((k) => k.n));

	const shown = $derived(
		data.contracts.filter((c) => {
			const s = status(c);
			if (kind !== 'alle' && c.kind !== kind) return false;
			if (show === 'laufend') return running(s);
			if (show === 'beendet') return !running(s);
			return true;
		})
	);

	/** Nach Kunde gruppiert, wie in einer Kartei */
	const groups = $derived.by(() => {
		const map = new Map<number, { customerId: number; customer: string; rows: Row[]; monthly: number }>();
		for (const c of shown) {
			const g = map.get(c.customerId) ?? { customerId: c.customerId, customer: c.customer, rows: [], monthly: 0 };
			g.rows.push(c);
			if (running(status(c))) g.monthly += monthlyCents(c.amountCents, intervalOf(c.interval).months);
			map.set(c.customerId, g);
		}
		return [...map.values()];
	});

	function edit(c: Row | null) {
		editing = c;
		formKey++;
		open = true;
	}
</script>

<svelte:head><title>Verträge – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Verträge</h1>
			<p class="lead">Hosting, Wartung und Support – wer welchen Vertrag hat und was jeden Monatsersten abgerechnet wird.</p>
		</div>
		<div class="actions">
			<form method="POST" action="?/abrechnen" use:enhance={submit()}>
				<button class="btn ghost" type="submit" title="Alle Zeiträume abrechnen, die bis heute begonnen haben"><Zap size={16} /> Fällige abrechnen</button>
			</form>
			<button class="btn" type="button" onclick={() => edit(null)}><Plus size={16} /> Neuer Vertrag</button>
		</div>
	</div>

	<div class="grid-4 stagger">
		<div class="card" use:glow style="--i: 0">
			<p class="small muted">Laufende Verträge</p>
			<p class="v num">{live.length}</p>
			{#if byKind.length}
				<p class="kinds small">{#each byKind as k (k.id)}<span style="--c: {k.color}"><i></i>{k.n} {k.label}</span>{/each}</p>
			{/if}
		</div>
		<div class="card" use:glow style="--i: 1">
			<p class="small muted">Wiederkehrend pro Monat</p>
			<p class="v num grad-text" use:countUp={{ value: mrr, format: (n) => money(Math.round(n)) }}>{money(0)}</p>
			<p class="small faint">netto, {money(Math.round(mrr * 12))} im Jahr</p>
		</div>
		<div class="card" use:glow style="--i: 2">
			<p class="small muted">Kunden mit Vertrag</p>
			<p class="v num">{customersWith}</p>
		</div>
		<div class="card" use:glow style="--i: 3">
			<p class="small muted">Nächste Abrechnung</p>
			{#if nextRun}
				<p class="v num">{date(nextRun)}</p>
				<p class="small faint">{relative(nextRun)} · {money(nextRunSum)} netto</p>
			{:else}
				<p class="v faint">–</p>
			{/if}
		</div>
	</div>

	{#if data.drafts.length}
		<section class="card review" use:glow>
			<div class="card-head"><h2><ReceiptText size={16} /> Zum Prüfen</h2><span class="small faint">Vertragsrechnungen als Entwurf</span></div>
			<ul class="drafts">
				{#each data.drafts as d (d.id)}
					<li>
						<a href="/rechnungen/{d.id}"><strong>{d.customer}</strong><small>{d.title}</small></a>
						<span class="small muted">{date(d.issueDate)}</span>
						<span class="num">{money(d.grossCents)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="layout">
		<section class="card flush main" use:glow>
			<div class="toolbar">
				<div class="row wrap">
					<button type="button" class="chip filter" class:on={kind === 'alle'} onclick={() => (kind = 'alle')}>Alle Arten</button>
					{#each CONTRACT_KINDS as k (k.id)}
						<button type="button" class="chip filter" class:on={kind === k.id} style="--c: {k.color}" onclick={() => (kind = k.id)}><i class="kdot"></i>{k.label}</button>
					{/each}
				</div>
				<select class="input pill" bind:value={show} aria-label="Status">
					<option value="laufend">Laufend</option>
					<option value="beendet">Beendet</option>
					<option value="alle">Alle</option>
				</select>
			</div>

			{#if groups.length}
				<div class="table-wrap">
					<table class="table">
						<thead><tr><th>Vertrag</th><th class="right">Betrag</th><th>Rechnung</th><th>Nächste</th><th>Status</th></tr></thead>
						{#each groups as g (g.customerId)}
							<tbody>
								<tr class="group">
									<th colspan="5">
										<a href="/kunden/{g.customerId}?tab=hosting">{g.customer}</a>
										{#if g.monthly}<span class="small faint num">{money(Math.round(g.monthly))} / Monat</span>{/if}
									</th>
								</tr>
								{#each g.rows as c (c.id)}
									{@const st = status(c)}
									{@const k = contractKindOf(c.kind)}
									<tr class="row" class:off={!running(st)} onclick={() => edit(c)}>
										<td>
											<button class="name" type="button" onclick={(e) => { e.stopPropagation(); edit(c); }}>
												<i class="kdot" style="--c: {k.color}" title={k.label}></i>
												<span><strong>{c.title}</strong><small>{c.items.map((it) => it.title).join(' · ')}{c.project ? ` · ${c.project}` : ''}</small></span>
											</button>
										</td>
										<td class="right num">{money(c.amountCents)}<small class="faint">{intervalOf(c.interval).label}</small></td>
										<td>
											{#if !c.autoInvoice}<span class="small faint">keine</span>
											{:else if c.autoSend}<span class="mode auto"><Send size={13} /> automatisch</span>
											{:else}<span class="mode"><FileSignature size={13} /> Entwurf</span>{/if}
										</td>
										<td class="small">{#if running(st) && c.autoInvoice}{c.nextInvoiceDate <= data.today ? 'fällig' : date(c.nextInvoiceDate)}{:else}–{/if}</td>
										<td>
											<span class="badge {STATUS_LABEL[st].tone}">{STATUS_LABEL[st].label}</span>
											{#if st === 'gekuendigt'}<small class="faint until">bis {date(c.endDate)}</small>{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						{/each}
					</table>
				</div>
			{:else}
				<div class="empty">
					<FileSignature size={28} />
					<p>{data.contracts.length ? 'Keine Verträge für diese Auswahl.' : 'Noch keine Verträge. Lege den ersten an – die Rechnungen entstehen dann jeden Monatsersten von selbst.'}</p>
					{#if !data.contracts.length}<button class="btn" type="button" onclick={() => edit(null)}><Plus size={16} /> Neuer Vertrag</button>{/if}
				</div>
			{/if}
		</section>

		<aside class="card side" use:glow>
			<div class="card-head"><h2><CalendarClock size={16} /> Nächste Rechnungen</h2></div>
			{#if data.upcoming.length}
				<ol class="timeline">
					{#each data.upcoming as u (`${u.date}-${u.customerId}`)}
						<li>
							<span class="when small">{date(u.date)}</span>
							<div>
								<strong>{u.customer}</strong>
								<small>{u.contracts.map((c) => c.title).join(', ')}</small>
							</div>
							<span class="amt num">{money(u.netCents)}</span>
							<span class="badge {u.automatic ? 'ok' : 'muted'}">{u.automatic ? 'automatisch' : 'Entwurf'}</span>
						</li>
					{/each}
				</ol>
				<p class="small faint">Beträge netto. Rechnungen eines Kunden am selben Tag werden zusammengefasst. Der Lauf startet täglich ab 3 Uhr.</p>
			{:else}
				<p class="small muted">Keine anstehenden Rechnungen.</p>
			{/if}
		</aside>
	</div>
</div>

<Modal bind:open wide title={editing ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}>
	{#key formKey}
		<ContractForm
			contract={editing}
			customers={data.customers}
			projects={data.projects.filter((p) => !editing || p.customerId === editing.customerId)}
			billings={editing ? data.billings.filter((b) => b.contractId === editing!.id) : []}
			done={() => (open = false)}
		/>
	{/key}
</Modal>

<style>
	.v {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.6rem;
	}

	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.7rem;
		margin-top: 0.35rem;
		color: var(--dust);
	}

	.kinds span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.kinds i,
	.kdot {
		display: inline-block;
		flex: none;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent);
	}

	.chip.filter {
		background: transparent;
		cursor: pointer;
		font: inherit;
		font-size: 0.8rem;
	}

	.chip.filter.on {
		border-color: var(--c, var(--accent));
		background: color-mix(in srgb, var(--c, var(--accent)) 14%, transparent);
		color: var(--star);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(17rem, 21rem);
		gap: 1rem;
		align-items: start;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid var(--line-soft);
	}

	.toolbar select {
		width: auto;
		min-width: 9rem;
	}

	.group th {
		padding-top: 1rem;
		background: rgb(143 155 255 / 0.04);
		text-align: left;
		font-weight: 600;
	}

	.group a {
		margin-right: 0.6rem;
		color: var(--star);
		text-decoration: none;
	}

	.group a:hover {
		text-decoration: underline;
	}

	.row {
		cursor: pointer;
	}

	.row.off {
		opacity: 0.55;
	}

	.name {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.name span {
		display: grid;
		line-height: 1.3;
	}

	.name strong {
		font-weight: 600;
	}

	.name small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	td small {
		display: block;
		font-size: 0.74rem;
	}

	.mode {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--dust);
		font-size: 0.82rem;
		white-space: nowrap;
	}

	.mode.auto {
		color: var(--accent);
	}

	.until {
		margin-top: 0.2rem;
	}

	.timeline {
		display: grid;
		gap: 0.65rem;
		margin: 0 0 0.9rem;
		padding: 0;
		list-style: none;
	}

	.timeline li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.15rem 0.6rem;
		padding: 0.6rem 0.7rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
		background: rgb(7 13 36 / 0.3);
	}

	.timeline .when {
		grid-column: 1 / -1;
		color: var(--accent);
	}

	.timeline div {
		display: grid;
		min-width: 0;
	}

	.timeline strong {
		font-size: 0.88rem;
	}

	.timeline small {
		overflow: hidden;
		color: var(--dust-2);
		font-size: 0.76rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.timeline .amt {
		align-self: center;
		font-weight: 600;
	}

	.timeline .badge {
		grid-column: 2;
		justify-self: end;
	}

	.drafts {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.drafts li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 6rem;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
	}

	.drafts a {
		display: grid;
		color: inherit;
		text-decoration: none;
	}

	.drafts a:hover strong {
		text-decoration: underline;
	}

	.drafts small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.drafts .num {
		text-align: right;
		font-weight: 600;
	}

	@media (max-width: 1400px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
