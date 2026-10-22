<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight } from '@lucide/svelte';
	import { submit } from '$lib/ui/form';
	import { glow } from '$lib/ui/actions';
	import { onServerChange } from '$lib/ui/sync.svelte';

	let { data } = $props();
	let type = $state('rechnung');
	onServerChange(() => data.type, () => (type = data.type));
	let customerId = $state('');
	const projects = $derived(data.projects.filter((p) => String(p.customerId) === customerId));
</script>

<svelte:head><title>Neuer Beleg – Astronox Portal</title></svelte:head>

<div class="page narrow">
	<div class="crumbs"><a href="/rechnungen">Angebote & Rechnungen</a> / Neu</div>
	<h1>{type === 'angebot' ? 'Neues Angebot' : 'Neue Rechnung'}</h1>

	<form method="POST" class="card stack" use:glow use:enhance={submit()}>
		<div class="seg">
			<label class:on={type === 'angebot'}><input type="radio" name="type" value="angebot" bind:group={type} /> Angebot</label>
			<label class:on={type === 'rechnung'}><input type="radio" name="type" value="rechnung" bind:group={type} /> Rechnung</label>
		</div>
		<label class="field">
			<span>Kunde</span>
			<select name="customerId" required bind:value={customerId}>
				<option value="">Bitte wählen …</option>
				{#each data.customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
			</select>
		</label>
		{#if !data.customers.length}<p class="small muted">Noch keine Kunden – <a href="/kunden?neu=1">zuerst einen anlegen</a>.</p>{/if}
		<label class="field">
			<span>Projekt <small>(optional)</small></span>
			<select name="projectId" disabled={!projects.length}>
				<option value="">– ohne Projekt –</option>
				{#each projects as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Titel <small>(sonst Projekttitel)</small></span>
			<input name="title" placeholder={type === 'angebot' ? 'z. B. Neue Webseite' : 'z. B. Webseite – Schlussrechnung'} />
		</label>
		<div class="form-actions"><button class="btn" type="submit">Weiter <ArrowRight size={16} /></button></div>
	</form>
</div>

<style>
	.narrow {
		max-width: 38rem;
	}

	.seg {
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
	}

	.seg label {
		display: grid;
		place-items: center;
		min-height: 2.2rem;
		border-radius: 999px;
		color: var(--dust);
		font-weight: 550;
		cursor: pointer;
		transition:
			background-color 0.25s,
			color 0.25s;
	}

	.seg label.on {
		background: var(--grad);
		color: var(--night);
	}

	.seg input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
