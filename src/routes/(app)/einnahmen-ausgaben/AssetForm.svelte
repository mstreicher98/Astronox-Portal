<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { afaSchedule } from '$lib/shared/ear';
	import { money, moneyInput, parseMoney, today } from '$lib/shared/format';
	import type { Asset } from '$lib/server/db/schema';
	import { submit } from '$lib/ui/form';
	import ReceiptField from './ReceiptField.svelte';

	let { asset, vat, ondone }: { asset?: Asset; vat: boolean; ondone: () => void } = $props();
	const a0 = untrack(() => asset);
	let cost = $state(a0 ? moneyInput(a0.costCents) : '');
	let start = $state(a0?.startDate ?? today());
	let years = $state(String(a0?.years ?? 3));
	let disposed = $state(a0?.disposedOn ?? '');
	const formId = `anlage-loeschen-${a0?.id ?? 0}`;

	// AfA-Plan schon beim Tippen
	const plan = $derived.by(() => {
		const c = parseMoney(cost);
		const y = Number(years);
		if (!c || !y || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
		return afaSchedule({ costCents: c, startDate: start, years: y, disposedOn: disposed || null });
	});
	const small = $derived((parseMoney(cost) ?? 0) > 0 && (parseMoney(cost) ?? 0) <= 100_000);
</script>

<form method="POST" action="?/anlage" enctype="multipart/form-data" class="stack" use:enhance={submit({ done: ondone })}>
	{#if a0}<input type="hidden" name="id" value={a0.id} />{/if}
	<div class="form-grid">
		<label class="field full"><span>Bezeichnung</span><input name="name" required maxlength="200" value={a0?.name ?? ''} placeholder="z. B. MacBook Pro 14″" /></label>
		<label class="field"><span>In Betrieb seit</span><input type="date" name="startDate" required bind:value={start} /></label>
		<label class="field"><span>Anschaffungskosten {vat ? 'netto' : 'brutto'} (€)</span><input name="cost" inputmode="decimal" required bind:value={cost} placeholder="0,00" /></label>
		<label class="field">
			<span>Nutzungsdauer (Jahre)</span>
			<input name="years" type="number" min="1" max="50" required bind:value={years} list="nutzungsdauer" />
			<datalist id="nutzungsdauer"><option value="3">Computer, Laptop</option><option value="2">Handy</option><option value="5">Drucker, Kamera</option><option value="10">Büromöbel</option></datalist>
		</label>
		<label class="field"><span>Ausgeschieden am <small>(verkauft, kaputt)</small></span><input type="date" name="disposedOn" bind:value={disposed} /></label>
		<ReceiptField href={a0?.receiptFile ? `/einnahmen-ausgaben/beleg/anlage/${a0.id}` : null} />
		<label class="field full"><span>Notiz <small>(optional)</small></span><textarea name="notes" rows="2">{a0?.notes ?? ''}</textarea></label>
	</div>
	{#if small}<p class="notice warn small">Bis 1.000 € kannst du das als geringwertiges Wirtschaftsgut sofort absetzen – dann besser als Ausgabe in „Geringwertige Wirtschaftsgüter“ buchen.</p>{/if}
	{#if plan.length}
		<div class="plan">
			<p class="small muted">AfA-Plan <small class="faint">(Halbjahresregel: Inbetriebnahme ab Juli → im ersten Jahr die Hälfte)</small></p>
			<table class="table">
				<thead><tr><th>Jahr</th><th class="right">AfA</th><th class="right">Restbuchwert</th></tr></thead>
				<tbody>
					{#each plan as p (p.year)}
						<tr>
							<td>{p.year}</td>
							<td class="right num">{money(p.cents)}</td>
							<td class="right num">{p.disposal ? `${money(0)} (Abgang ${money(p.disposal)})` : money(p.remaining)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
	<div class="form-actions">
		{#if a0}<button class="btn danger sm" type="submit" form={formId}>Löschen</button>{/if}
		<button class="btn" type="submit">{a0 ? 'Speichern' : 'Anlage aufnehmen'}</button>
	</div>
</form>
{#if a0}
	<form id={formId} method="POST" action="?/anlage_loeschen" hidden use:enhance={submit({ confirm: 'Anlage löschen?', confirmDetail: 'Die AfA fällt in allen Jahren weg, auch der Beleg wird gelöscht.', done: ondone })}>
		<input type="hidden" name="id" value={a0.id} />
	</form>
{/if}

<style>
	.plan {
		display: grid;
		gap: 0.4rem;
		max-height: 16rem;
		overflow: auto;
	}
</style>
