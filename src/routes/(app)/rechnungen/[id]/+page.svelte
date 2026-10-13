<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowDown, ArrowUp, Ban, CircleCheck, CircleX, Copy, Download, FileCheck2, GripVertical, Lock, Mail, Package, Plus, ReceiptText, RotateCcw, Trash2, Wallet } from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { fly, slide } from 'svelte/transition';
	import Compose from '$lib/components/Compose.svelte';
	import { date, dateTime, money, moneyInput, number, parseMoney, parseNumber, today } from '$lib/shared/format';
	import { DOC_STATUS } from '$lib/shared/stages';
	import { autosize, glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const d = $derived(data.doc);
	const draft = $derived(d.status === 'entwurf');
	const label = $derived(d.type === 'angebot' ? 'Angebot' : d.cancelsId ? 'Stornorechnung' : 'Rechnung');

	interface Row {
		key: number;
		title: string;
		description: string;
		quantity: string;
		unit: string;
		price: string;
	}
	let seq = 0;
	const toRow = (i: { title: string; description: string | null; quantity: number; unit: string; unitPriceCents: number }): Row => ({
		key: seq++,
		title: i.title,
		description: i.description ?? '',
		quantity: number(i.quantity),
		unit: i.unit,
		price: moneyInput(i.unitPriceCents)
	});

	const initial = () => ({ rows: data.items.map(toRow), taxMode: data.doc.taxMode, taxRate: String(data.doc.taxRate) });
	let rows = $state<Row[]>(initial().rows);
	let taxMode = $state<'klein' | 'ust'>(initial().taxMode);
	let taxRate = $state(initial().taxRate);
	$effect(() => {
		rows = data.items.map(toRow);
		taxMode = data.doc.taxMode;
		taxRate = String(data.doc.taxRate);
	});

	const lineTotal = (r: Row) => Math.round((parseNumber(r.quantity) ?? 0) * (parseMoney(r.price) ?? 0));
	const net = $derived(rows.reduce((s, r) => s + lineTotal(r), 0));
	const tax = $derived(taxMode === 'ust' ? Math.round((net * (Number(taxRate) || 0)) / 100) : 0);
	const itemsJson = $derived(
		JSON.stringify(rows.map((r) => ({ title: r.title, description: r.description, quantity: parseNumber(r.quantity) ?? 1, unit: r.unit, unitPriceCents: parseMoney(r.price) ?? 0 })))
	);

	function addRow(i?: { title: string; description: string | null; unit: string; unitPriceCents: number }) {
		rows.push(i ? toRow({ ...i, quantity: 1 }) : { key: seq++, title: '', description: '', quantity: '1', unit: 'Std.', price: '' });
	}
	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= rows.length) return;
		[rows[i], rows[j]] = [rows[j], rows[i]];
	}

	let pdfVersion = $state(Date.now());
	let mailOpen = $state(false);
	let mailTemplate = $state('');
	let pkgOpen = $state(false);

	const overdue = $derived(d.type === 'rechnung' && d.status === 'offen' && !!d.dueDate && d.dueDate < today());
	function openMail(kind: 'beleg' | 'mahnung') {
		mailTemplate = kind === 'mahnung' ? 'mahnung' : d.type;
		mailOpen = true;
	}
	const mailValues = $derived({
		anrede: data.recipient?.salutationName ? `Guten Tag ${data.recipient.salutationName},` : 'Guten Tag,',
		name: data.recipient?.name ?? data.customer.name,
		nummer: d.number ?? '',
		titel: d.title,
		betrag: money(d.grossCents),
		datum: d.dueDate ? date(d.dueDate) : '',
		projekt: d.title
	});
</script>

<svelte:head><title>{label} {d.number ?? '(Entwurf)'} – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<div class="crumbs"><a href="/rechnungen?typ={d.type}">{d.type === 'angebot' ? 'Angebote' : 'Rechnungen'}</a> / {d.number ?? 'Entwurf'}</div>
			<h1>{label} <span class="mono num">{d.number ?? ''}</span></h1>
			<p class="lead row wrap">
				<span class="badge {overdue ? 'danger' : DOC_STATUS[d.status].tone} dot">{overdue ? 'überfällig' : DOC_STATUS[d.status].label}</span>
				<a href="/kunden/{data.customer.id}">{data.customer.name}</a>
				{#if d.sentAt}<span class="small muted">verschickt {dateTime(d.sentAt)}</span>{/if}
				{#if d.paidAt}<span class="small muted">bezahlt am {date(d.paidAt)}</span>{/if}
			</p>
		</div>
		<div class="actions">
			<a class="btn ghost sm" href="/rechnungen/{d.id}/pdf?download=1" data-sveltekit-reload><Download size={15} /> PDF</a>
			<form method="POST" action="?/kopieren" use:enhance={submit()}><button class="btn ghost sm" type="submit"><Copy size={15} /> Kopieren</button></form>
		</div>
	</div>

	<div class="layout">
		<div class="stack">
			{#if draft}
				<form method="POST" action="?/speichern" class="stack" use:enhance={submit({ done: () => (pdfVersion = Date.now()) })}>
					<input type="hidden" name="items" value={itemsJson} />
					<div class="card stack" use:glow>
						<div class="form-grid">
							<label class="field">
								<span>Kunde</span>
								<select name="customerId" value={String(d.customerId)}>
									{#each data.customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
								</select>
							</label>
							<label class="field">
								<span>Projekt</span>
								<select name="projectId" value={d.projectId ? String(d.projectId) : ''}>
									<option value="">– ohne –</option>
									{#each data.projects as p (p.id)}<option value={String(p.id)}>{p.title}</option>{/each}
								</select>
							</label>
							<label class="field full"><span>Titel</span><input name="title" required value={d.title} /></label>
							<label class="field"><span>Datum</span><input name="issueDate" type="date" value={d.issueDate} /></label>
							<label class="field"><span>{d.type === 'angebot' ? 'Gültig bis' : 'Fällig am'}</span><input name="dueDate" type="date" value={d.dueDate ?? ''} /></label>
							<label class="field full"><span>Leistungszeitraum <small>(Pflicht auf Rechnungen, z. B. „Oktober 2026“ oder Liefertag)</small></span><input name="servicePeriod" value={d.servicePeriod ?? ''} /></label>
							<label class="field full"><span>Einleitung <small>(nach „Guten Tag,“)</small></span><textarea name="intro" rows="2" use:autosize>{d.intro ?? ''}</textarea></label>
						</div>
					</div>

					<div class="card stack" use:glow>
						<div class="spread">
							<h2>Positionen</h2>
							<div class="row">
								{#if data.packages.length}<button class="btn quiet sm" type="button" onclick={() => (pkgOpen = !pkgOpen)}><Package size={14} /> Aus Paketen</button>{/if}
								<button class="btn ghost sm" type="button" onclick={() => addRow()}><Plus size={14} /> Position</button>
							</div>
						</div>
						{#if pkgOpen}
							<div class="pkgs" transition:slide={{ duration: 220 }}>
								{#each data.packages as p (p.title)}
									<button type="button" class="chip" onclick={() => addRow(p)}>{p.title} · {money(p.unitPriceCents)}</button>
								{/each}
							</div>
						{/if}
						<div class="items">
							{#each rows as r, i (r.key)}
								<div class="item" animate:flip={{ duration: 260 }} in:fly={{ y: 10, duration: 280 }}>
									<span class="pos"><GripVertical size={14} /> {i + 1}</span>
									<div class="main">
										<input class="input title" bind:value={r.title} placeholder="Leistung" aria-label="Leistung" />
										<textarea class="input desc" bind:value={r.description} rows="1" use:autosize placeholder="Beschreibung (optional)" aria-label="Beschreibung"></textarea>
										<div class="nums">
											<label><small>Menge</small><input class="input qty num" bind:value={r.quantity} inputmode="decimal" /></label>
											<label><small>Einheit</small><input class="input unit" bind:value={r.unit} list="einheiten" /></label>
											<label><small>Einzelpreis €</small><input class="input price num" bind:value={r.price} inputmode="decimal" placeholder="0,00" /></label>
											<span class="total num">{money(lineTotal(r))}</span>
										</div>
									</div>
									<span class="tools">
										<button class="btn quiet icon sm" type="button" aria-label="Nach oben" onclick={() => move(i, -1)}><ArrowUp size={13} /></button>
										<button class="btn quiet icon sm" type="button" aria-label="Nach unten" onclick={() => move(i, 1)}><ArrowDown size={13} /></button>
										<button class="btn quiet icon sm" type="button" aria-label="Entfernen" onclick={() => rows.splice(i, 1)}><Trash2 size={13} /></button>
									</span>
								</div>
							{:else}
								<p class="small muted">Noch keine Positionen.</p>
							{/each}
						</div>
						<datalist id="einheiten"><option>Std.</option><option>Pauschale</option><option>Stk.</option><option>Monat</option><option>Jahr</option><option>Seite</option></datalist>

						<div class="sums">
							<div class="tax row wrap">
								<label class="field">
									<span>Umsatzsteuer</span>
									<select name="taxMode" bind:value={taxMode}>
										<option value="klein">Kleinunternehmer (ohne USt.)</option>
										<option value="ust">mit USt.</option>
									</select>
								</label>
								{#if taxMode === 'ust'}<label class="field rate"><span>Satz %</span><input name="taxRate" bind:value={taxRate} inputmode="numeric" /></label>{:else}<input type="hidden" name="taxRate" value={taxRate} />{/if}
							</div>
							<dl>
								{#if taxMode === 'ust'}<dt>Netto</dt><dd class="num">{money(net)}</dd><dt>USt. {taxRate} %</dt><dd class="num">{money(tax)}</dd>{/if}
								<dt class="strong">Gesamt</dt><dd class="strong num grad-text">{money(net + tax)}</dd>
							</dl>
						</div>
					</div>

					<div class="card stack" use:glow>
						<label class="field"><span>Schlusstext</span><textarea name="outro" rows="2" use:autosize>{d.outro ?? ''}</textarea></label>
					</div>

					<div class="form-actions sticky-actions">
						<button class="btn danger" type="submit" formaction="?/loeschen" formnovalidate><Trash2 size={15} /> Entwurf löschen</button>
						<button class="btn ghost" type="submit">Speichern</button>
					</div>
				</form>
			{:else}
				<div class="card stack" use:glow>
					<div class="spread">
						<h2><Lock size={15} /> Festgeschrieben</h2>
						<span class="small faint">{dateTime(d.finalizedAt)}</span>
					</div>
					<p class="small muted">Dieser Beleg ist unveränderlich. {d.type === 'rechnung' && !d.cancelsId ? 'Korrekturen gehen über eine Stornorechnung.' : ''}</p>
					<div class="table-wrap">
						<table class="table">
							<thead><tr><th>Pos.</th><th>Leistung</th><th class="right">Menge</th><th class="right">Preis</th><th class="right">Gesamt</th></tr></thead>
							<tbody>
								{#each data.items as it, i (it.id)}
									<tr>
										<td class="muted">{i + 1}</td>
										<td><strong>{it.title}</strong>{#if it.description}<br /><small class="muted prewrap">{it.description}</small>{/if}</td>
										<td class="right num">{number(it.quantity)} {it.unit}</td>
										<td class="right num">{money(it.unitPriceCents)}</td>
										<td class="right num">{money(it.totalCents)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<dl class="final">
						{#if d.taxMode === 'ust'}<dt>Netto</dt><dd class="num">{money(d.netCents)}</dd><dt>USt. {d.taxRate} %</dt><dd class="num">{money(d.taxCents)}</dd>{/if}
						<dt class="strong">Gesamt</dt><dd class="strong num grad-text">{money(d.grossCents)}</dd>
					</dl>
				</div>
			{/if}
		</div>

		<aside class="stack side">
			<div class="card stack status" use:glow>
				{#if draft}
					<p class="small muted">Prüfe die Vorschau. Beim Festschreiben bekommt der Beleg die nächste Nummer und lässt sich danach nicht mehr ändern.</p>
					<form method="POST" action="?/festschreiben" use:enhance={submit({ confirm: `${label} jetzt festschreiben?`, confirmDetail: 'Bitte vorher speichern. Danach sind Änderungen nicht mehr möglich.', done: () => (pdfVersion = Date.now()) })}>
						<button class="btn wide" type="submit"><FileCheck2 size={16} /> Festschreiben</button>
					</form>
				{:else}
					{#if !d.cancelsId}
						<button class="btn wide" type="button" onclick={() => openMail('beleg')} disabled={!data.recipient}><Mail size={16} /> {d.sentAt ? 'Erneut senden' : 'Per E-Mail senden'}</button>
					{/if}
					{#if overdue}
						<button class="btn ghost wide" type="button" onclick={() => openMail('mahnung')}><Mail size={16} /> Zahlungserinnerung</button>
					{/if}
					{#if d.type === 'rechnung' && d.status === 'offen'}
						<form method="POST" action="?/bezahlt" class="paid" use:enhance={submit()}>
							<input class="input" type="date" name="paidAt" value={today()} aria-label="Bezahlt am" />
							<button class="btn ghost" type="submit"><Wallet size={15} /> Bezahlt</button>
						</form>
					{/if}
					{#if d.type === 'angebot' && d.status === 'offen'}
						<div class="row">
							<form method="POST" action="?/entscheidung" use:enhance={submit()} style="flex: 1">
								<input type="hidden" name="angenommen" value="on" />
								<button class="btn ghost wide" type="submit"><CircleCheck size={15} /> Angenommen</button>
							</form>
							<form method="POST" action="?/entscheidung" use:enhance={submit()} style="flex: 1">
								<button class="btn ghost wide" type="submit"><CircleX size={15} /> Abgelehnt</button>
							</form>
						</div>
					{/if}
					{#if d.type === 'angebot' && ['offen', 'angenommen'].includes(d.status)}
						<form method="POST" action="?/in_rechnung" use:enhance={submit()}>
							<button class="btn ghost wide" type="submit"><ReceiptText size={15} /> In Rechnung umwandeln</button>
						</form>
					{/if}
					{#if ['bezahlt', 'angenommen', 'abgelehnt'].includes(d.status) && !d.cancelsId}
						<form method="POST" action="?/offen" use:enhance={submit()}>
							<button class="btn quiet wide sm" type="submit"><RotateCcw size={14} /> Status zurücksetzen</button>
						</form>
					{/if}
					{#if d.type === 'rechnung' && ['offen', 'bezahlt'].includes(d.status) && !d.cancelsId}
						<form method="POST" action="?/stornieren" use:enhance={submit({ confirm: `Rechnung ${d.number} stornieren?`, confirmDetail: 'Es wird eine Stornorechnung mit negativen Beträgen erstellt und festgeschrieben.' })}>
							<button class="btn quiet wide sm" type="submit"><Ban size={14} /> Stornieren</button>
						</form>
					{/if}
				{/if}

				{#if data.links.quote || data.links.invoices.length || data.links.cancels || data.links.cancelledBy}
					<hr class="divider" />
					<ul class="links small">
						{#if data.links.quote}<li>Aus Angebot <a href="/rechnungen/{data.links.quote.id}">{data.links.quote.number}</a></li>{/if}
						{#each data.links.invoices as r (r.id)}<li>Rechnung <a href="/rechnungen/{r.id}">{r.number ?? 'Entwurf'}</a></li>{/each}
						{#if data.links.cancels}<li>Storniert <a href="/rechnungen/{data.links.cancels.id}">{data.links.cancels.number}</a></li>{/if}
						{#if data.links.cancelledBy}<li>Storno <a href="/rechnungen/{data.links.cancelledBy.id}">{data.links.cancelledBy.number}</a></li>{/if}
					</ul>
				{/if}
				{#if data.mails.length}
					<hr class="divider" />
					<ul class="links small">
						{#each data.mails as m (m.id)}<li><a href="/posteingang/{m.id}">{m.status === 'fehler' ? '⚠ ' : ''}{dateTime(m.date)} an {m.toAddrs}</a></li>{/each}
					</ul>
				{/if}
			</div>

			<div class="preview">
				{#key pdfVersion}
					<iframe title="PDF-Vorschau" src="/rechnungen/{d.id}/pdf#view=FitH&toolbar=0"></iframe>
				{/key}
			</div>
		</aside>
	</div>
</div>

<Compose
	bind:open={mailOpen}
	to={data.recipient?.email ?? data.customer.email ?? ''}
	template={mailTemplate}
	values={mailValues}
	customerId={d.customerId}
	projectId={d.projectId}
	documentId={d.id}
	documentLabel="{label} {d.number}"
/>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(20rem, 0.75fr);
		gap: 1rem;
		align-items: start;
	}

	.lead a {
		color: var(--dust);
	}

	.items {
		display: grid;
		gap: 0.5rem;
	}

	.item {
		display: grid;
		grid-template-columns: 2.2rem minmax(0, 1fr) auto;
		gap: 0.45rem;
		align-items: start;
		padding: 0.55rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
		background: rgb(7 13 36 / 0.3);
	}

	.item .input {
		min-height: 2.3rem;
		padding: 0.35rem 0.55rem;
		font-size: 0.88rem;
	}

	.main {
		display: grid;
		gap: 0.35rem;
	}

	.desc {
		min-height: 2rem !important;
		resize: none;
		color: var(--dust);
		font-size: 0.82rem !important;
	}

	.title {
		font-weight: 600;
	}

	.nums {
		display: grid;
		grid-template-columns: 5rem 6.5rem 8rem minmax(0, 1fr);
		gap: 0.45rem;
		align-items: end;
	}

	.nums label {
		display: grid;
		gap: 0.15rem;
	}

	.nums small {
		color: var(--dust-2);
		font-size: 0.7rem;
	}

	.pos {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding-top: 0.55rem;
		color: var(--dust-2);
		font-size: 0.8rem;
	}

	.qty,
	.price {
		text-align: right;
	}

	.total {
		padding-bottom: 0.55rem;
		text-align: right;
		font-weight: 600;
		font-size: 0.92rem;
	}

	.tools {
		display: flex;
		flex-direction: column;
	}

	.pkgs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.pkgs .chip {
		background: transparent;
		cursor: pointer;
	}

	.pkgs .chip:hover {
		border-color: var(--accent);
		color: var(--star);
	}

	.sums {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--line-soft);
	}

	.tax .field {
		min-width: 14rem;
	}

	.tax .rate {
		min-width: 5rem;
		width: 5rem;
	}

	dl {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.3rem 1.5rem;
		margin: 0;
		text-align: right;
	}

	dt {
		color: var(--dust);
	}

	dd {
		margin: 0;
	}

	.strong {
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.25rem;
		color: var(--star);
	}

	.final {
		justify-content: end;
	}

	.sticky-actions {
		position: sticky;
		bottom: 0.75rem;
		z-index: 5;
		padding: 0.6rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: var(--glass-strong);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		justify-self: end;
	}

	.side {
		position: sticky;
		top: calc(var(--topbar) + 1rem);
	}

	.wide {
		width: 100%;
	}

	.paid {
		display: flex;
		gap: 0.5rem;
	}

	.paid .input {
		flex: 1;
		min-height: 2.5rem;
	}

	.links {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--dust);
	}

	.links a {
		color: var(--accent);
	}

	.preview {
		border: 1px solid var(--line-soft);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: #fff;
		aspect-ratio: 1 / 1.414;
		box-shadow: 0 30px 70px -30px rgb(0 0 0 / 0.8);
	}

	.preview iframe {
		width: 100%;
		height: 100%;
		border: 0;
	}

	@media (max-width: 1150px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			position: static;
		}
	}

	@media (max-width: 760px) {
		.item {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.item .pos {
			display: none;
		}
		.nums {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
		.total {
			grid-column: 1 / -1;
		}
	}
</style>
