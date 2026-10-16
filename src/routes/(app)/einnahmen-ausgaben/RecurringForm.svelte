<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { CATEGORIES, PAYMENT_METHODS, TAX_RATES } from '$lib/shared/ear';
	import { moneyInput, today } from '$lib/shared/format';
	import { INTERVALS } from '$lib/shared/stages';
	import type { LedgerRecurring } from '$lib/server/db/schema';
	import { submit } from '$lib/ui/form';

	let { item, ondone }: { item?: LedgerRecurring; ondone: () => void } = $props();
	const r0 = untrack(() => item);
	const cats = CATEGORIES.filter((c) => c.kind === 'ausgabe');
</script>

<form method="POST" action="?/wiederkehrend" class="stack" use:enhance={submit({ done: ondone })}>
	{#if r0}<input type="hidden" name="id" value={r0.id} />{/if}
	<div class="form-grid">
		<label class="field full"><span>Beschreibung</span><input name="description" required maxlength="300" value={r0?.description ?? ''} placeholder="z. B. Server bei Hetzner, Adobe Creative Cloud" /></label>
		<label class="field"><span>Lieferant <small>(optional)</small></span><input name="party" maxlength="200" value={r0?.party ?? ''} /></label>
		<label class="field">
			<span>Kategorie</span>
			<select name="category" value={r0?.category ?? 'software'}>
				{#each cats as c (c.id)}<option value={c.id}>{c.label} · KZ {c.kz}</option>{/each}
			</select>
		</label>
		<label class="field"><span>Betrag brutto (€)</span><input name="amount" inputmode="decimal" required value={r0 ? moneyInput(r0.grossCents) : ''} placeholder="0,00" /></label>
		<label class="field">
			<span>USt im Beleg</span>
			<select name="taxRate" value={String(r0?.taxRate ?? 20)}>
				{#each TAX_RATES as r (r)}<option value={String(r)}>{r} %</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Wie oft</span>
			<select name="interval" value={r0?.interval ?? 'monat'}>
				{#each INTERVALS as i (i.id)}<option value={i.id}>{i.label}</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Bezahlt mit <small>(optional)</small></span>
			<select name="paymentMethod" value={r0?.paymentMethod ?? ''}>
				<option value="">–</option>
				{#each PAYMENT_METHODS as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
			</select>
		</label>
		<label class="field"><span>Nächste Buchung am</span><input type="date" name="date" required value={r0?.nextDate ?? today()} /></label>
		<label class="field"><span>Endet am <small>(optional)</small></span><input type="date" name="endDate" value={r0?.endDate ?? ''} /></label>
	</div>
	<p class="small faint">Fällige Termine werden sofort und danach täglich automatisch gebucht. Den Beleg lädst du bei der jeweiligen Buchung hoch.</p>
	<div class="form-actions"><button class="btn" type="submit">{r0 ? 'Speichern' : 'Anlegen'}</button></div>
</form>
