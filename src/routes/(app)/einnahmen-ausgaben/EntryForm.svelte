<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Car } from '@lucide/svelte';
	import { CATEGORIES, KM_RATE_CENTS, PAYMENT_METHODS, TAX_RATES, type EntryKind } from '$lib/shared/ear';
	import { moneyInput, parseNumber, today } from '$lib/shared/format';
	import { submit } from '$lib/ui/form';
	import ReceiptField from './ReceiptField.svelte';

	interface EntryData {
		id: number;
		kind: EntryKind;
		date: string;
		description: string;
		party: string | null;
		category: string;
		grossCents: number;
		taxRate: number;
		paymentMethod: string | null;
		notes: string | null;
		receipt: boolean;
	}

	let { entry, kind = 'ausgabe', vat, ondone }: { entry?: EntryData; kind?: EntryKind; vat: boolean; ondone: () => void } = $props();

	const e0 = untrack(() => entry);
	const k = untrack(() => entry?.kind ?? kind);
	const cats = CATEGORIES.filter((c) => c.kind === k);
	let category = $state(e0?.category ?? (k === 'einnahme' ? 'erloese' : 'software'));
	let amount = $state(e0 ? moneyInput(e0.grossCents) : '');
	let taxRate = $state(String(e0?.taxRate ?? (k === 'ausgabe' ? 20 : 0)));
	let km = $state('');
	const hint = $derived(cats.find((c) => c.id === category)?.hint);
	const formId = `buchung-loeschen-${untrack(() => entry?.id ?? 0)}`;

	// Kilometergeld: km × amtlicher Satz, ohne Umsatzsteuer
	function applyKm() {
		const n = parseNumber(km);
		if (!n) return;
		amount = moneyInput(Math.round(n * KM_RATE_CENTS));
		taxRate = '0';
	}
</script>

<form method="POST" action="?/buchung" enctype="multipart/form-data" class="stack" use:enhance={submit({ done: ondone })}>
	{#if e0}<input type="hidden" name="id" value={e0.id} />{/if}
	<input type="hidden" name="kind" value={k} />
	<div class="form-grid">
		<label class="field"><span>Bezahlt am</span><input type="date" name="date" required value={e0?.date ?? today()} /></label>
		<label class="field"><span>Betrag brutto (€)</span><input name="amount" inputmode="decimal" required bind:value={amount} placeholder="0,00" /></label>
		<label class="field full">
			<span>Beschreibung</span>
			<input name="description" required maxlength="300" value={e0?.description ?? ''} placeholder={k === 'ausgabe' ? 'z. B. Adobe-Abo Oktober, Laptop-Tasche' : 'z. B. Förderung, Zinsen'} />
		</label>
		<label class="field"><span>{k === 'ausgabe' ? 'Lieferant' : 'Von'} <small>(optional)</small></span><input name="party" maxlength="200" value={e0?.party ?? ''} /></label>
		<label class="field">
			<span>Kategorie</span>
			<select name="category" bind:value={category}>
				{#each cats as c (c.id)}<option value={c.id}>{c.label} · KZ {c.kz}</option>{/each}
			</select>
		</label>
		{#if hint}<p class="small faint full">{hint}</p>{/if}
		{#if category === 'reise'}
			<div class="km full">
				<Car size={15} /> Kilometergeld:
				<input class="input" inputmode="decimal" bind:value={km} placeholder="km" aria-label="Gefahrene Kilometer" />
				× {moneyInput(KM_RATE_CENTS)} €
				<button class="btn quiet sm" type="button" onclick={applyKm}>Übernehmen</button>
			</div>
		{/if}
		<label class="field">
			<span>USt im Beleg</span>
			<select name="taxRate" bind:value={taxRate}>
				{#each TAX_RATES as r (r)}<option value={String(r)}>{r} %</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Bezahlt mit <small>(optional)</small></span>
			<select name="paymentMethod" value={e0?.paymentMethod ?? ''}>
				<option value="">–</option>
				{#each PAYMENT_METHODS as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
			</select>
		</label>
		{#if k === 'ausgabe' || e0?.receipt}
			<ReceiptField href={e0?.receipt ? `/einnahmen-ausgaben/beleg/buchung/${e0.id}` : null} />
		{/if}
		<label class="field full"><span>Notiz <small>(optional)</small></span><textarea name="notes" rows="2">{e0?.notes ?? ''}</textarea></label>
	</div>
	{#if !vat && k === 'ausgabe'}<p class="small faint">Als Kleinunternehmer zählt der Bruttobetrag – der USt-Satz wird nur vermerkt.</p>{/if}
	<div class="form-actions">
		{#if e0}<button class="btn danger sm" type="submit" form={formId}>Löschen</button>{/if}
		<button class="btn" type="submit">{e0 ? 'Speichern' : k === 'ausgabe' ? 'Ausgabe buchen' : 'Einnahme buchen'}</button>
	</div>
</form>
{#if e0}
	<form id={formId} method="POST" action="?/buchung_loeschen" hidden use:enhance={submit({ confirm: 'Buchung löschen?', confirmDetail: 'Auch der Beleg wird gelöscht. Belege müssen 7 Jahre aufbewahrt werden.', done: ondone })}>
		<input type="hidden" name="id" value={e0.id} />
	</form>
{/if}

<style>
	.km {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		color: var(--dust);
		font-size: 0.88rem;
	}

	.km .input {
		width: 6rem;
	}
</style>
