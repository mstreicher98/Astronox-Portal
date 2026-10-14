<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { CalendarX2, Plus, Trash2, Undo2 } from '@lucide/svelte';
	import { contractStatus, earliestEnd, STATUS_LABEL } from '$lib/shared/billing';
	import { date, money, moneyInput, parseMoney, parseNumber, today } from '$lib/shared/format';
	import { CONTRACT_KINDS, contractKindOf, INTERVALS, intervalOf, type ContractKind } from '$lib/shared/stages';
	import { autosize } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	/**
	 * Formular für einen Hosting-, Wartungs- oder Supportvertrag.
	 * `action` ist die Formular-Aktion der Seite (z. B. „?/vertrag“); Kündigen
	 * und Zurücknehmen laufen über „…_kuendigen“ bzw. „…_kuendigung_zuruecknehmen“.
	 */
	interface Item {
		title: string;
		description: string | null;
		quantity: number;
		unit: string;
		unitPriceCents: number;
	}
	interface ContractData {
		id: number;
		customerId: number;
		projectId: number | null;
		kind: string;
		title: string;
		description: string | null;
		interval: string;
		startDate: string;
		endDate: string | null;
		nextInvoiceDate: string;
		autoInvoice: boolean;
		autoSend: boolean;
		minTermMonths: number | null;
		noticeMonths: number | null;
		cancelledOn: string | null;
		active: boolean;
		items: Item[];
	}
	interface Billing {
		id: number;
		contractId: number;
		documentId: number | null;
		periodFrom: string;
		periodTo: string;
		amountCents: number;
		number: string | null;
		status: string | null;
	}

	let {
		contract = null,
		action = '?/vertrag',
		customers = null,
		projects = [],
		billings = [],
		done
	}: {
		contract?: ContractData | null;
		action?: string;
		/** nur auf der Vertragsübersicht: Kunde beim Anlegen wählen */
		customers?: { id: number; name: string }[] | null;
		/** Projekte des Kunden zur Zuordnung (optional) */
		projects?: { id: number; title: string; customerId?: number }[];
		billings?: Billing[];
		done: () => void;
	} = $props();

	type Row = { key: number; title: string; description: string; quantity: string; unit: string; price: string };
	let keySeq = 0;
	const toRow = (i: Item): Row => ({ key: ++keySeq, title: i.title, description: i.description ?? '', quantity: String(i.quantity).replace('.', ','), unit: i.unit, price: moneyInput(i.unitPriceCents) });
	const kindRow = (k: ContractKind): Row => {
		const def = contractKindOf(k);
		return { key: ++keySeq, title: def.item, description: def.description, quantity: '1', unit: 'Pauschale', price: '' };
	};

	// Startwerte aus dem Vertrag – das Formular wird bei jedem Öffnen neu erzeugt
	const c0 = untrack(() => contract);
	let kind = $state<ContractKind>((c0?.kind as ContractKind) ?? 'hosting');
	let title = $state(c0?.title ?? contractKindOf('hosting').title);
	let rows = $state<Row[]>(c0?.items.length ? c0.items.map(toRow) : [kindRow('hosting')]);
	let interval = $state(c0?.interval ?? 'monat');
	let startDate = $state(c0?.startDate ?? today());
	let billing = $state<'aus' | 'entwurf' | 'automatisch'>(c0 ? (!c0.autoInvoice ? 'aus' : c0.autoSend ? 'automatisch' : 'entwurf') : 'entwurf');
	let minTerm = $state(c0?.minTermMonths ? String(c0.minTermMonths) : '');
	let notice = $state(c0?.noticeMonths != null ? String(c0.noticeMonths) : '1');
	let customerId = $state(c0 ? String(c0.customerId) : '');
	let cancelling = $state(false);
	let cancelledOn = $state(today());
	let cancelEnd = $state('');

	/** Titel und Positionen folgen der Art, solange man sie nicht selbst geändert hat */
	let titleTouched = !!c0;
	let rowsTouched = !!c0;
	function pickKind(k: ContractKind) {
		kind = k;
		if (!titleTouched) title = contractKindOf(k).title;
		if (!rowsTouched) rows = [kindRow(k)];
	}

	const lineTotal = (r: Row) => Math.round((parseNumber(r.quantity) ?? 0) * (parseMoney(r.price) ?? 0));
	const sum = $derived(rows.reduce((s, r) => s + lineTotal(r), 0));
	const months = $derived(intervalOf(interval).months);
	const itemsJson = $derived(
		JSON.stringify(rows.map((r) => ({ title: r.title, description: r.description, quantity: parseNumber(r.quantity) ?? 1, unit: r.unit, unitPriceCents: parseMoney(r.price) ?? 0 })))
	);
	const status = $derived(c0 ? contractStatus(c0, today()) : null);
	const suggestedEnd = $derived(c0 && cancelledOn ? earliestEnd(c0.startDate, cancelledOn, parseNumber(notice) ?? c0.noticeMonths, parseNumber(minTerm) ?? c0.minTermMonths) : '');
	const customerProjects = $derived(projects.filter((p) => p.customerId == null || String(p.customerId) === customerId));
	const firstPartial = $derived(!c0 && startDate.slice(8) !== '01');
</script>

<form method="POST" {action} class="stack" use:enhance={submit({ done })}>
	{#if c0}<input type="hidden" name="id" value={c0.id} />{/if}
	<input type="hidden" name="items" value={itemsJson} />
	<input type="hidden" name="kind" value={kind} />
	<input type="hidden" name="autoInvoice" value={billing !== 'aus' ? 'on' : ''} />
	<input type="hidden" name="autoSend" value={billing === 'automatisch' ? 'on' : ''} />

	{#if status}
		<p class="status-line"><span class="badge {STATUS_LABEL[status].tone} dot">{STATUS_LABEL[status].label}</span>
			{#if c0?.cancelledOn}<span class="small muted">gekündigt am {date(c0.cancelledOn)}, endet am {date(c0.endDate)}</span>
			{:else if c0?.active && c0.autoInvoice}<span class="small muted">nächste Rechnung am {date(c0.nextInvoiceDate)}</span>{/if}
		</p>
	{/if}

	<div class="seg kinds" role="radiogroup" aria-label="Art des Vertrags">
		{#each CONTRACT_KINDS as k (k.id)}
			<button type="button" role="radio" aria-checked={kind === k.id} class:on={kind === k.id} style="--c: {k.color}" onclick={() => pickKind(k.id)}><i></i>{k.label}</button>
		{/each}
	</div>

	<div class="form-grid">
		{#if customers && !c0}
			<label class="field">
				<span>Kunde</span>
				<select name="customerId" bind:value={customerId} required>
					<option value="">Bitte wählen …</option>
					{#each customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
				</select>
			</label>
		{/if}
		<label class="field" class:full={!(customers && !c0)}><span>Bezeichnung</span><input name="title" required bind:value={title} oninput={() => (titleTouched = true)} placeholder="z. B. Hosting & Wartung Paket M" /></label>
		{#if customerProjects.length}
			<label class="field">
				<span>Projekt <small>(optional)</small></span>
				<select name="projectId" value={c0?.projectId ? String(c0.projectId) : ''}>
					<option value="">kein Projekt</option>
					{#each customerProjects as p (p.id)}<option value={String(p.id)}>{p.title}</option>{/each}
				</select>
			</label>
		{/if}
	</div>

	<fieldset class="block">
		<legend>Positionen auf der Rechnung <small>je Abrechnungszeitraum, netto</small></legend>
		<div class="items">
			{#each rows as r, i (r.key)}
				<div class="item">
					<div class="main">
						<input class="input title" bind:value={r.title} oninput={() => (rowsTouched = true)} placeholder="Leistung" aria-label="Leistung" />
						<textarea class="input desc" bind:value={r.description} oninput={() => (rowsTouched = true)} rows="1" use:autosize placeholder="Beschreibung (optional)" aria-label="Beschreibung"></textarea>
						<div class="nums">
							<label><small>Menge</small><input class="input num right" bind:value={r.quantity} oninput={() => (rowsTouched = true)} inputmode="decimal" /></label>
							<label><small>Einheit</small><input class="input" bind:value={r.unit} oninput={() => (rowsTouched = true)} list="vertrag-einheiten" /></label>
							<label><small>Preis €</small><input class="input num right" bind:value={r.price} oninput={() => (rowsTouched = true)} inputmode="decimal" placeholder="0,00" /></label>
							<span class="total num">{money(lineTotal(r))}</span>
						</div>
					</div>
					<button class="btn quiet icon sm" type="button" aria-label="Position entfernen" disabled={rows.length === 1} onclick={() => { rows.splice(i, 1); rowsTouched = true; }}><Trash2 size={13} /></button>
				</div>
			{/each}
		</div>
		<datalist id="vertrag-einheiten"><option>Pauschale</option><option>Monat</option><option>Std.</option><option>Stk.</option><option>Domain</option></datalist>
		<div class="spread">
			<button class="btn quiet sm" type="button" onclick={() => { rows.push({ key: ++keySeq, title: '', description: '', quantity: '1', unit: 'Pauschale', price: '' }); rowsTouched = true; }}><Plus size={14} /> Position</button>
			<p class="sum">
				<strong class="num grad-text">{money(sum)}</strong> <span class="small muted">{intervalOf(interval).label}</span>
				{#if months > 1}<span class="small faint">· {money(Math.round(sum / months))} pro Monat</span>{/if}
			</p>
		</div>
	</fieldset>

	<div class="form-grid">
		<label class="field">
			<span>Abrechnung</span>
			<select name="interval" bind:value={interval}>
				{#each INTERVALS as iv (iv.id)}<option value={iv.id}>{iv.label}</option>{/each}
			</select>
		</label>
		<label class="field"><span>Beginn</span><input name="startDate" type="date" bind:value={startDate} required /></label>
	</div>
	{#if firstPartial}
		<p class="hint small">Der Vertrag beginnt mitten im Monat: Die erste Rechnung gilt anteilig bis Monatsende, danach wird jeweils am Ersten im Voraus abgerechnet.</p>
	{/if}

	<fieldset class="block">
		<legend>Rechnungen</legend>
		<div class="modes" role="radiogroup" aria-label="Rechnungen">
			<label class:on={billing === 'automatisch'}>
				<input type="radio" bind:group={billing} value="automatisch" />
				<strong>Automatisch senden</strong>
				<small>Am Ersten festschreiben und mit PDF per E-Mail an den Kunden schicken.</small>
			</label>
			<label class:on={billing === 'entwurf'}>
				<input type="radio" bind:group={billing} value="entwurf" />
				<strong>Entwurf zum Prüfen</strong>
				<small>Rechnung wird angelegt, du prüfst und sendest selbst.</small>
			</label>
			<label class:on={billing === 'aus'}>
				<input type="radio" bind:group={billing} value="aus" />
				<strong>Keine Rechnung</strong>
				<small>Nur zur Übersicht, z. B. bei Abrechnung über einen Partner.</small>
			</label>
		</div>
		{#if billing === 'automatisch'}
			<p class="hint small">Sind mehrere Verträge eines Kunden am selben Tag fällig, kommen sie auf eine Sammelrechnung. Die geht nur automatisch raus, wenn alle Verträge darauf auf „Automatisch senden“ stehen.</p>
		{/if}
	</fieldset>

	<details class="more" open={!!(c0?.minTermMonths || c0?.endDate)}>
		<summary>Laufzeit, Kündigung und Notiz</summary>
		<div class="stack">
			<div class="form-grid">
				<label class="field"><span>Mindestlaufzeit <small>(Monate)</small></span><input name="minTermMonths" bind:value={minTerm} inputmode="numeric" placeholder="keine" /></label>
				<label class="field"><span>Kündigungsfrist <small>(Monate zum Monatsende)</small></span><input name="noticeMonths" bind:value={notice} inputmode="numeric" /></label>
				<label class="field"><span>Endet am <small>(optional)</small></span><input name="endDate" type="date" value={c0?.endDate ?? ''} /></label>
				{#if c0}<label class="field"><span>Nächste Rechnung ab</span><input name="nextInvoiceDate" type="date" value={c0.nextInvoiceDate} /></label>{/if}
			</div>
			{#if c0?.cancelledOn}<input type="hidden" name="cancelledOn" value={c0.cancelledOn} />{/if}
			<label class="field"><span>Notiz <small>(nur intern)</small></span><textarea name="description" rows="2" use:autosize>{c0?.description ?? ''}</textarea></label>
			{#if c0}<label class="switch"><input type="checkbox" name="active" checked={c0.active} /> Vertrag aktiv</label>{/if}
		</div>
	</details>

	<div class="form-actions">
		{#if c0 && !c0.cancelledOn && status !== 'beendet'}
			<button class="btn ghost" type="button" onclick={() => (cancelling = !cancelling)}><CalendarX2 size={15} /> Kündigung erfassen</button>
		{/if}
		{#if c0?.cancelledOn}
			<button class="btn ghost" type="submit" formaction="{action}_kuendigung_zuruecknehmen" formnovalidate><Undo2 size={15} /> Kündigung zurücknehmen</button>
		{/if}
		<button class="btn" type="submit">Speichern</button>
	</div>
</form>

{#if cancelling && c0}
	<form method="POST" action="{action}_kuendigen" class="cancel stack" use:enhance={submit({ done })}>
		<input type="hidden" name="id" value={c0.id} />
		<div class="form-grid">
			<label class="field"><span>Kündigung eingegangen am</span><input name="cancelledOn" type="date" bind:value={cancelledOn} required /></label>
			<label class="field"><span>Vertrag endet am</span><input name="endDate" type="date" bind:value={cancelEnd} placeholder={suggestedEnd} /></label>
		</div>
		<p class="small muted">
			Frühestmöglich: <strong>{date(suggestedEnd)}</strong>
			({c0.noticeMonths ?? 0} {c0.noticeMonths === 1 ? 'Monat' : 'Monate'} Frist zum Monatsende{c0.minTermMonths ? `, Mindestlaufzeit ${c0.minTermMonths} Monate` : ''}). Leer lassen, um diesen Tag zu übernehmen. Bis dahin wird weiter abgerechnet, der letzte Zeitraum bei Bedarf anteilig.
		</p>
		<div class="form-actions"><button class="btn danger" type="submit">Kündigung speichern</button></div>
	</form>
{/if}

{#if billings.length}
	<section class="history">
		<h3>Abrechnungen</h3>
		<ul>
			{#each billings as b (b.id)}
				<li>
					<span>{date(b.periodFrom)} – {date(b.periodTo)}</span>
					<span class="num">{money(b.amountCents)}</span>
					{#if b.documentId}<a href="/rechnungen/{b.documentId}">{b.number ?? 'Entwurf'}</a>{:else}<span class="faint">Rechnung gelöscht</span>{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.status-line {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.seg {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.seg button {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.45rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: transparent;
		color: var(--dust);
		font: inherit;
		font-size: 0.86rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background-color 0.2s,
			color 0.2s;
	}

	.seg button i {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent);
	}

	.seg button.on {
		border-color: var(--c);
		background: color-mix(in srgb, var(--c) 14%, transparent);
		color: var(--star);
	}

	.block {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}

	legend {
		margin-bottom: 0.55rem;
		font-size: 0.88rem;
		font-weight: 600;
	}

	legend small {
		color: var(--dust-2);
		font-weight: 400;
	}

	.items {
		display: grid;
		gap: 0.45rem;
	}

	.item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.45rem;
		align-items: start;
		padding: 0.55rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
		background: rgb(7 13 36 / 0.3);
	}

	.main {
		display: grid;
		gap: 0.35rem;
	}

	.item .input {
		min-height: 2.3rem;
		padding: 0.35rem 0.55rem;
		font-size: 0.88rem;
	}

	.item .title {
		font-weight: 600;
	}

	.item .desc {
		min-height: 2rem;
		resize: none;
		color: var(--dust);
		font-size: 0.82rem;
	}

	.nums {
		display: grid;
		grid-template-columns: 4.5rem 6.5rem 7rem minmax(0, 1fr);
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

	.right {
		text-align: right;
	}

	.total {
		padding-bottom: 0.55rem;
		text-align: right;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.sum {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.sum strong {
		font-size: 1.15rem;
	}

	.modes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.modes label {
		position: relative;
		display: grid;
		align-content: start;
		gap: 0.2rem;
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 12px;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}

	.modes label:hover {
		border-color: var(--dust-2);
	}

	.modes label.on {
		border-color: var(--accent);
		background: var(--accent-soft, rgb(94 234 212 / 0.12));
	}

	.modes label:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.modes input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.modes strong {
		font-size: 0.86rem;
	}

	.modes small {
		color: var(--dust);
		font-size: 0.76rem;
		line-height: 1.4;
	}

	.hint {
		color: var(--dust);
	}

	.more {
		border-top: 1px solid var(--line-soft);
		padding-top: 0.6rem;
	}

	.more summary {
		cursor: pointer;
		color: var(--dust);
		font-size: 0.88rem;
		margin-bottom: 0.6rem;
	}

	.cancel {
		margin-top: 1rem;
		padding: 0.9rem;
		border: 1px solid rgb(255 138 122 / 0.35);
		border-radius: 12px;
		background: rgb(255 138 122 / 0.05);
	}

	.history {
		margin-top: 1.25rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--line-soft);
	}

	.history h3 {
		margin-bottom: 0.5rem;
		font-size: 0.86rem;
	}

	.history ul {
		display: grid;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.84rem;
	}

	.history li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto 7rem;
		gap: 0.75rem;
		color: var(--dust);
	}

	.history a {
		color: var(--accent);
		text-align: right;
	}

	@media (max-width: 640px) {
		.modes {
			grid-template-columns: minmax(0, 1fr);
		}
		.nums {
			grid-template-columns: 4rem minmax(0, 1fr) 6rem;
		}
		.total {
			grid-column: 1 / -1;
			padding: 0;
		}
	}
</style>
