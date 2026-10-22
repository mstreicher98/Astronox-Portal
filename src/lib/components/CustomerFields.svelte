<script lang="ts">
	import type { Customer } from '$lib/server/db/schema';
	import { onServerChange } from '$lib/ui/sync.svelte';

	/** Stammdaten eines Kunden – für „Neu“ und „Bearbeiten“ */
	let { customer = null, withContact = false }: { customer?: Customer | null; withContact?: boolean } = $props();
	const initial = () => customer?.kind ?? 'firma';
	let kind = $state<'firma' | 'privat'>(initial());
	onServerChange(() => [customer?.id, customer?.kind], () => (kind = initial()));
</script>

<div class="form-grid">
	<label class="field">
		<span>Art</span>
		<select name="kind" bind:value={kind}>
			<option value="firma">Firma / Verein</option>
			<option value="privat">Privatperson</option>
		</select>
	</label>
	<label class="field">
		<span>{kind === 'firma' ? 'Firmenname' : 'Vor- und Nachname'}</span>
		<input name="name" required value={customer?.name ?? ''} />
	</label>
	{#if withContact && kind === 'firma'}
		<label class="field full">
			<span>Ansprechperson</span>
			<input name="contact" placeholder="Vor- und Nachname" />
		</label>
	{/if}
	<label class="field">
		<span>E-Mail</span>
		<input name="email" type="email" value={customer?.email ?? ''} />
	</label>
	<label class="field">
		<span>Telefon</span>
		<input name="phone" type="tel" value={customer?.phone ?? ''} />
	</label>
	<label class="field full">
		<span>Straße und Hausnummer</span>
		<input name="street" value={customer?.street ?? ''} autocomplete="street-address" />
	</label>
	<label class="field">
		<span>PLZ</span>
		<input name="zip" value={customer?.zip ?? ''} inputmode="numeric" />
	</label>
	<label class="field">
		<span>Ort</span>
		<input name="city" value={customer?.city ?? ''} />
	</label>
	{#if customer}
		<label class="field">
			<span>Land</span>
			<input name="country" value={customer.country} />
		</label>
	{/if}
	<label class="field">
		<span>Webseite</span>
		<input name="website" value={customer?.website ?? ''} placeholder="https://…" />
	</label>
	{#if kind === 'firma'}
		<label class="field">
			<span>UID-Nummer</span>
			<input name="vatId" value={customer?.vatId ?? ''} placeholder="ATU…" />
		</label>
	{/if}
</div>
