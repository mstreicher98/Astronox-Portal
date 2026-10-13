<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Building2, Plus, Search, User, Users } from '@lucide/svelte';
	import CustomerFields from '$lib/components/CustomerFields.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { initials, moneyShort, relative } from '$lib/shared/format';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	let creating = $state(page.url.searchParams.has('neu'));
	let q = $state('');
	let kind = $state<'alle' | 'firma' | 'privat' | 'kunden' | 'interessenten'>('alle');

	const shown = $derived(
		data.customers.filter((c) => {
			if (q && !`${c.name} ${c.email ?? ''} ${c.city ?? ''} ${c.contact ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
			if (kind === 'firma' || kind === 'privat') return c.kind === kind;
			if (kind === 'kunden') return c.won > 0;
			if (kind === 'interessenten') return c.won === 0;
			return true;
		})
	);
	const hues = ['var(--accent)', 'var(--sky)', 'var(--nebula)', 'var(--violet)', 'var(--pink)', 'var(--peach)'];
</script>

<svelte:head><title>Kunden – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Kunden</h1>
			<p class="lead">{data.customers.filter((c) => c.won).length} Kunden, {data.customers.filter((c) => !c.won).length} Interessenten</p>
		</div>
		<div class="actions">
			<a class="btn quiet sm" href={data.archiv ? '?' : '?filter=archiv'}>{data.archiv ? 'Aktive zeigen' : 'Archiv'}</a>
			<button class="btn" type="button" onclick={() => (creating = true)}><Plus size={16} /> Kunde</button>
		</div>
	</div>

	<div class="row wrap">
		<label class="search">
			<Search size={16} />
			<input bind:value={q} placeholder="Name, E-Mail, Ort …" />
		</label>
		<select class="input filter" bind:value={kind} aria-label="Filter">
			<option value="alle">Alle</option>
			<option value="kunden">Mit Auftrag</option>
			<option value="interessenten">Interessenten</option>
			<option value="firma">Firmen</option>
			<option value="privat">Privat</option>
		</select>
	</div>

	{#if shown.length}
		<div class="card flush">
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Name</th><th>Kontakt</th><th>Ort</th><th class="right">Offene Projekte</th><th class="right">Umsatz</th><th>Zuletzt</th></tr></thead>
					<tbody class="stagger">
						{#each shown as c, i (c.id)}
							<tr style="--i: {i}">
								<td>
									<a class="who" href="/kunden/{c.id}">
										<span class="av" style="--c: {hues[c.id % hues.length]}">{initials(c.name)}</span>
										<span>
											<strong>{c.name}</strong>
											<small>{#if c.kind === 'firma'}<Building2 size={11} /> Firma{:else}<User size={11} /> Privat{/if}{c.won ? '' : ' · Interessent'}</small>
										</span>
									</a>
								</td>
								<td class="small">{c.contact ?? ''}{#if c.contact && c.email}<br />{/if}<span class="muted">{c.email ?? ''}</span></td>
								<td class="muted">{c.city ?? '–'}</td>
								<td class="right num">{c.openProjects || '–'}</td>
								<td class="right num">{c.revenue ? moneyShort(c.revenue) : '–'}</td>
								<td class="small muted">{relative(c.lastActivity ?? c.createdAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<div class="card empty">
			<Users size={30} />
			<p>{q ? 'Niemand gefunden.' : 'Noch keine Kunden. Neue Anfragen von der Webseite landen automatisch hier.'}</p>
		</div>
	{/if}
</div>

<Modal bind:open={creating} title="Neuer Kunde" wide>
	<form method="POST" action="?/neu" class="stack" use:enhance={submit({ done: () => (creating = false) })}>
		<CustomerFields withContact />
		<div class="form-actions">
			<button class="btn ghost" type="button" onclick={() => (creating = false)}>Abbrechen</button>
			<button class="btn" type="submit"><Plus size={16} /> Anlegen</button>
		</div>
	</form>
</Modal>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		max-width: 22rem;
		padding: 0 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
		color: var(--dust-2);
	}

	.search input {
		flex: 1;
		min-width: 0;
		height: 2.3rem;
		border: 0;
		background: transparent;
		outline: none;
		font-size: 0.88rem;
	}

	.filter {
		width: auto;
		min-height: 2.35rem;
		padding: 0.3rem 2rem 0.3rem 0.9rem;
		border-radius: 999px;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		text-decoration: none;
	}

	.who span:last-child {
		display: grid;
		line-height: 1.3;
	}

	.who strong {
		font-weight: 600;
	}

	.who:hover strong {
		color: var(--accent);
	}

	.who small {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--dust-2);
		font-size: 0.75rem;
	}

	.av {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 12px;
		background: color-mix(in srgb, var(--c) 16%, transparent);
		color: var(--c);
		font-size: 0.78rem;
		font-weight: 700;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 35%, transparent);
	}
</style>
