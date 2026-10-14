<script lang="ts">
	import { enhance } from '$app/forms';
	import { Building2, Info, ReceiptText } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { moneyInput } from '$lib/shared/format';
	import { documentNumber } from '$lib/shared/numbers';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const f = $derived(data.firma);
	const r = $derived(data.rechnung);
	let taxMode = $state<'klein' | 'ust'>('klein');
	$effect(() => {
		taxMode = data.rechnung.taxMode;
	});
	const year = new Date().getFullYear();
	// Vorschau der Nummern beim Tippen
	const r0 = untrack(() => data.rechnung);
	let invoiceFormat = $state(r0.invoicePrefix);
	let quoteFormat = $state(r0.quotePrefix);
	let digits = $state(r0.digits);
</script>

<svelte:head><title>Firma & Rechnungen – Einstellungen</title></svelte:head>

<form method="POST" action="?/firma" class="card stack" use:glow use:enhance={submit()}>
	<h2><Building2 size={17} /> Briefkopf</h2>
	<p class="small muted">Steht auf Angeboten und Rechnungen. Wird beim Festschreiben eingefroren – spätere Änderungen betreffen nur neue Belege.</p>
	{#if !f.street || !f.iban}
		<p class="notice warn"><Info size={16} /> Vor der ersten Rechnung: Anschrift und Bankverbindung eintragen (nach der Gewerbeanmeldung).</p>
	{/if}
	<div class="form-grid">
		<label class="field"><span>Firmenname</span><input name="name" required value={f.name} /></label>
		<label class="field"><span>Inhaber</span><input name="owner" value={f.owner} /></label>
		<label class="field full"><span>Straße und Hausnummer</span><input name="street" value={f.street} /></label>
		<label class="field"><span>PLZ</span><input name="zip" value={f.zip} /></label>
		<label class="field"><span>Ort</span><input name="city" value={f.city} /></label>
		<label class="field"><span>Land</span><input name="country" value={f.country} /></label>
		<label class="field"><span>E-Mail</span><input name="email" type="email" value={f.email} /></label>
		<label class="field"><span>Telefon</span><input name="phone" value={f.phone} /></label>
		<label class="field"><span>Webseite</span><input name="website" value={f.website} /></label>
		<label class="field"><span>UID-Nummer <small>(falls vorhanden)</small></span><input name="vatId" value={f.vatId} placeholder="ATU…" /></label>
		<label class="field"><span>Steuernummer</span><input name="taxNumber" value={f.taxNumber} /></label>
		<label class="field"><span>Bank</span><input name="bank" value={f.bank} /></label>
		<label class="field"><span>IBAN</span><input name="iban" value={f.iban} class="mono" /></label>
		<label class="field"><span>BIC</span><input name="bic" value={f.bic} class="mono" /></label>
		<label class="field full"><span>Zusatz in der Fußzeile <small>(z. B. Gewerbebehörde, Firmenbuch)</small></span><input name="footerNote" value={f.footerNote} /></label>
	</div>
	<div class="form-actions"><button class="btn" type="submit">Speichern</button></div>
</form>

<form method="POST" action="?/rechnung" class="card stack" use:glow use:enhance={submit()}>
	<h2><ReceiptText size={17} /> Angebote & Rechnungen</h2>
	<div class="form-grid">
		<label class="field">
			<span>Umsatzsteuer</span>
			<select name="taxMode" bind:value={taxMode}>
				<option value="klein">Kleinunternehmer (ohne USt.)</option>
				<option value="ust">Regelbesteuerung (mit USt.)</option>
			</select>
		</label>
		<label class="field"><span>USt.-Satz %</span><input name="taxRate" inputmode="numeric" value={r.taxRate} disabled={taxMode === 'klein'} /></label>
		{#if taxMode === 'klein'}<label class="field full"><span>Hinweis auf der Rechnung</span><input name="kleinText" value={r.kleinText} /></label>{/if}
		<label class="field"><span>Rechnungsnummer <small>– Format</small></span><input name="invoicePrefix" bind:value={invoiceFormat} /><small class="hint">z. B. {documentNumber(invoiceFormat, year, 1, digits)}, {documentNumber(invoiceFormat, year, 2, digits)} …</small></label>
		<label class="field"><span>Angebotsnummer <small>– Format</small></span><input name="quotePrefix" bind:value={quoteFormat} /><small class="hint">z. B. {documentNumber(quoteFormat, year, 1, digits)}, {documentNumber(quoteFormat, year, 2, digits)} …</small></label>
		<p class="small muted full">{'{JJ}'} = Jahr zweistellig, {'{JJJJ}'} = Jahr, {'{NR}'} = laufende Nummer. Sie beginnt jedes Jahr wieder bei 1.</p>
		<label class="field"><span>Mindeststellen der Nummer</span><input name="digits" type="number" min="1" max="6" bind:value={digits} /><small class="hint">4 = 0001, 0002 … · 1 = ohne führende Nullen</small></label>
		<label class="field"><span>Standard-Stundensatz (€)</span><input name="hourlyRate" inputmode="decimal" value={moneyInput(r.hourlyRateCents)} /></label>
		<label class="field"><span>Zahlungsziel (Tage)</span><input name="paymentDays" type="number" min="0" value={r.paymentDays} /></label>
		<label class="field"><span>Angebote gültig (Tage)</span><input name="quoteValidDays" type="number" min="1" value={r.quoteValidDays} /></label>
		<label class="field full"><span>Einleitung Angebot</span><textarea name="quoteIntro" rows="2">{r.quoteIntro}</textarea></label>
		<label class="field full"><span>Schluss Angebot</span><textarea name="quoteOutro" rows="2">{r.quoteOutro}</textarea></label>
		<label class="field full"><span>Einleitung Rechnung</span><textarea name="invoiceIntro" rows="2">{r.invoiceIntro}</textarea></label>
		<label class="field full"><span>Schluss Rechnung</span><textarea name="invoiceOutro" rows="2">{r.invoiceOutro}</textarea></label>
	</div>
	<p class="small faint">Wechsel auf Regelbesteuerung: ab dann für neue Belege. Nummernkreise beginnen jedes Jahr neu und sind lückenlos.</p>
	<div class="form-actions"><button class="btn" type="submit">Speichern</button></div>
</form>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
