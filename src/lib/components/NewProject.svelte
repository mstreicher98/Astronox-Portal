<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus } from '@lucide/svelte';
	import Modal from './Modal.svelte';
	import { PROJECT_KINDS, STAGES, type StageId } from '$lib/shared/stages';
	import { submit } from '$lib/ui/form';

	/** Dialog „Neues Projekt“ – für vorhandenen oder neuen Kunden */
	let {
		open = $bindable(false),
		customers,
		customerId = null,
		stage = 'anfrage',
		action = '?/neu'
	}: { open: boolean; customers: { id: number; name: string }[]; customerId?: number | null; stage?: StageId; action?: string } = $props();

	let mode = $state<'vorhanden' | 'neu'>('vorhanden');
	let kind = $state<'firma' | 'privat'>('firma');
	$effect(() => {
		if (open) mode = customers.length ? 'vorhanden' : 'neu';
	});
</script>

<Modal bind:open title="Neues Projekt">
	<form method="POST" {action} class="stack" use:enhance={submit({ done: () => (open = false) })}>
		<input type="hidden" name="open" value="1" />
		<label class="field">
			<span>Titel</span>
			<input name="title" required placeholder="z. B. Neue Webseite für die Tischlerei" />
		</label>

		{#if customerId}
			<input type="hidden" name="customerId" value={customerId} />
		{:else}
			<div class="seg" role="radiogroup" aria-label="Kunde">
				<button type="button" class:on={mode === 'vorhanden'} onclick={() => (mode = 'vorhanden')} disabled={!customers.length}>Vorhandener Kunde</button>
				<button type="button" class:on={mode === 'neu'} onclick={() => (mode = 'neu')}>Neuer Kunde</button>
			</div>
			{#if mode === 'vorhanden'}
				<label class="field">
					<span>Kunde</span>
					<select name="customerId" required>
						<option value="">Bitte wählen …</option>
						{#each customers as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
					</select>
				</label>
			{:else}
				<div class="form-grid">
					<label class="field">
						<span>Art</span>
						<select name="newKind" bind:value={kind}>
							<option value="firma">Firma / Verein</option>
							<option value="privat">Privatperson</option>
						</select>
					</label>
					<label class="field">
						<span>{kind === 'firma' ? 'Firmenname' : 'Name'}</span>
						<input name="newCustomer" required />
					</label>
					{#if kind === 'firma'}
						<label class="field">
							<span>Ansprechperson</span>
							<input name="newContact" />
						</label>
					{/if}
					<label class="field">
						<span>E-Mail</span>
						<input name="newEmail" type="email" />
					</label>
				</div>
			{/if}
		{/if}

		<div class="form-grid">
			<label class="field">
				<span>Art des Projekts</span>
				<select name="kind">
					{#each PROJECT_KINDS as k (k.id)}<option value={k.id}>{k.label}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>Phase</span>
				<select name="stage" value={stage}>
					{#each STAGES as s (s.id)}<option value={s.id}>{s.label}</option>{/each}
				</select>
			</label>
			<label class="field">
				<span>Geschätzter Wert <small>(€, optional)</small></span>
				<input name="value" inputmode="decimal" placeholder="1.690" />
			</label>
			<label class="field">
				<span>Fertig bis <small>(optional)</small></span>
				<input name="dueDate" type="date" />
			</label>
		</div>
		<div class="form-actions">
			<button class="btn ghost" type="button" onclick={() => (open = false)}>Abbrechen</button>
			<button class="btn" type="submit"><Plus size={16} /> Anlegen</button>
		</div>
	</form>
</Modal>

<style>
	.seg {
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
	}

	.seg button {
		min-height: 2.1rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--dust);
		font-size: 0.86rem;
		font-weight: 550;
		cursor: pointer;
		transition:
			background-color 0.25s,
			color 0.25s;
	}

	.seg button.on {
		background: var(--grad);
		color: var(--night);
	}

	.seg button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
