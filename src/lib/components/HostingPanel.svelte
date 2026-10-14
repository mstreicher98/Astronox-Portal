<script lang="ts">
	import { enhance } from '$app/forms';
	import { Activity, Globe, Pencil, Plus, Repeat, ShieldCheck } from '@lucide/svelte';
	import ContractForm from './ContractForm.svelte';
	import Modal from './Modal.svelte';
	import type { Contract, ContractBilling, ContractItem, Domain, Monitor } from '$lib/server/db/schema';
	import { contractStatus, STATUS_LABEL } from '$lib/shared/billing';
	import { date, daysBetween, dayOf, money, relative, today } from '$lib/shared/format';
	import { contractKindOf, intervalOf } from '$lib/shared/stages';
	import { submit } from '$lib/ui/form';

	type ContractRow = Contract & { items: ContractItem[] };
	type BillingRow = ContractBilling & { number: string | null; status: string | null };

	/** Verträge, Domains und Überwachung – bei Kunde und Projekt */
	let {
		contracts,
		domains,
		monitors,
		billings = [],
		projects = []
	}: { contracts: ContractRow[]; domains: Domain[]; monitors: Monitor[]; billings?: BillingRow[]; projects?: { id: number; title: string }[] } = $props();

	let dialog = $state<'vertrag' | 'domain' | 'monitor' | null>(null);
	let contract = $state<ContractRow | null>(null);
	let domain = $state<Domain | null>(null);
	let monitor = $state<Monitor | null>(null);
	let open = $state(false);

	function show(kind: 'vertrag' | 'domain' | 'monitor', item: ContractRow | Domain | Monitor | null = null) {
		dialog = kind;
		contract = kind === 'vertrag' ? (item as ContractRow | null) : null;
		domain = kind === 'domain' ? (item as Domain | null) : null;
		monitor = kind === 'monitor' ? (item as Monitor | null) : null;
		open = true;
	}

	const close = () => (open = false);
	const day = today();
</script>

<div class="grid">
	<section>
		<div class="spread">
			<h3><Repeat size={15} /> Verträge</h3>
			<button class="btn quiet sm" type="button" onclick={() => show('vertrag')}><Plus size={14} /> Vertrag</button>
		</div>
		{#each contracts as c (c.id)}
			{@const st = contractStatus(c, day)}
			<button type="button" class="item" class:off={st === 'beendet' || st === 'pausiert'} onclick={() => show('vertrag', c)}>
				<span class="kind" style="--c: {contractKindOf(c.kind).color}" title={contractKindOf(c.kind).label}></span>
				<span class="txt">
					<strong>{c.title}</strong>
					<small>
						{money(c.amountCents)} {intervalOf(c.interval).label}
						{#if st === 'aktiv' || st === 'geplant'}{#if c.autoInvoice} · nächste Rechnung {relative(c.nextInvoiceDate)}{c.autoSend ? ' (automatisch)' : ''}{:else} · ohne Rechnung{/if}{/if}
						{#if st === 'gekuendigt'} · endet am {date(c.endDate)}{/if}
					</small>
				</span>
				{#if st !== 'aktiv'}<span class="badge {STATUS_LABEL[st].tone}">{STATUS_LABEL[st].label}</span>{/if}
				<Pencil size={14} />
			</button>
		{:else}
			<p class="small faint">Kein Vertrag.</p>
		{/each}
	</section>

	<section>
		<div class="spread">
			<h3><Globe size={15} /> Domains</h3>
			<button class="btn quiet sm" type="button" onclick={() => show('domain')}><Plus size={14} /> Domain</button>
		</div>
		{#each domains as d (d.id)}
			{@const left = d.expiresOn ? daysBetween(day, d.expiresOn) : null}
			<button type="button" class="item" onclick={() => show('domain', d)}>
				<span class="txt"><strong>{d.name}</strong><small>{d.registrar ?? 'Registrar unbekannt'}{d.expiresOn ? ` · bis ${date(d.expiresOn)}` : ''}{d.autoRenew ? ' · verlängert sich' : ''}</small></span>
				{#if left != null && left < 30}<span class="badge {left < 0 ? 'danger' : 'warn'}">{left < 0 ? 'abgelaufen' : `${left} Tage`}</span>{/if}
			</button>
		{:else}
			<p class="small faint">Keine Domain.</p>
		{/each}
	</section>

	<section>
		<div class="spread">
			<h3><Activity size={15} /> Überwachung</h3>
			<button class="btn quiet sm" type="button" onclick={() => show('monitor')}><Plus size={14} /> Seite</button>
		</div>
		{#each monitors as m (m.id)}
			<button type="button" class="item" onclick={() => show('monitor', m)}>
				<span class="status {m.enabled ? m.status : 'aus'}" title={m.status}></span>
				<span class="txt">
					<strong>{m.name}</strong>
					<small>
						{m.url.replace(/^https?:\/\//, '')}
						{#if m.lastResponseMs != null} · {m.lastResponseMs} ms{/if}
						{#if m.sslExpiresAt} · <ShieldCheck size={11} /> {date(dayOf(m.sslExpiresAt))}{/if}
					</small>
				</span>
				{#if m.status === 'offline'}<span class="badge danger dot">offline</span>{/if}
			</button>
		{:else}
			<p class="small faint">Keine Überwachung.</p>
		{/each}
	</section>
</div>

<Modal bind:open wide={dialog === 'vertrag'} title={dialog === 'vertrag' ? (contract ? 'Vertrag bearbeiten' : 'Neuer Vertrag') : dialog === 'domain' ? (domain ? 'Domain bearbeiten' : 'Neue Domain') : monitor ? 'Überwachung bearbeiten' : 'Seite überwachen'}>
	{#if dialog === 'vertrag'}
		<ContractForm {contract} {projects} billings={contract ? billings.filter((x) => x.contractId === contract!.id) : []} done={close} />
	{:else if dialog === 'domain'}
		<form method="POST" action="?/domain" class="stack" use:enhance={submit({ done: close })}>
			{#if domain}<input type="hidden" name="id" value={domain.id} />{/if}
			<label class="field"><span>Domain</span><input name="name" required value={domain?.name ?? ''} placeholder="beispiel.at" /></label>
			<div class="form-grid">
				<label class="field"><span>Registrar</span><input name="registrar" value={domain?.registrar ?? ''} placeholder="z. B. Cloudflare, World4You" /></label>
				<label class="field"><span>Läuft ab am</span><input name="expiresOn" type="date" value={domain?.expiresOn ?? ''} /></label>
			</div>
			<label class="switch"><input type="checkbox" name="autoRenew" checked={domain?.autoRenew ?? true} /> Verlängert sich automatisch</label>
			<label class="field"><span>Notizen</span><textarea name="notes" rows="2">{domain?.notes ?? ''}</textarea></label>
			<div class="form-actions">
				{#if domain}<button class="btn danger" type="submit" formaction="?/domain_loeschen" formnovalidate>Entfernen</button>{/if}
				<button class="btn" type="submit">Speichern</button>
			</div>
		</form>
	{:else if dialog === 'monitor'}
		<form method="POST" action="?/monitor" class="stack" use:enhance={submit({ done: close })}>
			{#if monitor}<input type="hidden" name="id" value={monitor.id} />{/if}
			<label class="field"><span>Adresse</span><input name="url" required value={monitor?.url ?? ''} placeholder="https://beispiel.at" /></label>
			<div class="form-grid">
				<label class="field"><span>Name</span><input name="name" value={monitor?.name ?? ''} placeholder="wird sonst aus der Adresse gebildet" /></label>
				<label class="field"><span>Prüfen alle … Minuten</span><input name="intervalMin" type="number" min="1" max="60" value={monitor?.intervalMin ?? 5} /></label>
			</div>
			<label class="field"><span>Dieser Text muss vorkommen <small>(optional)</small></span><input name="keyword" value={monitor?.keyword ?? ''} placeholder="z. B. Firmenname im Seitentitel" /></label>
			{#if monitor}<label class="switch"><input type="checkbox" name="enabled" checked={monitor.enabled} /> Aktiv</label>{/if}
			<div class="form-actions">
				{#if monitor}<button class="btn danger" type="submit" formaction="?/monitor_loeschen" formnovalidate>Entfernen</button>{/if}
				<button class="btn" type="submit">Speichern</button>
			</div>
		</form>
	{/if}
</Modal>

<style>
	.grid {
		display: grid;
		gap: 1.25rem;
	}

	h3 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.9rem;
	}

	h3 :global(svg) {
		color: var(--dust-2);
	}

	section {
		display: grid;
		gap: 0.35rem;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
		background: rgb(7 13 36 / 0.3);
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}

	.item:hover {
		border-color: var(--line);
		background: rgb(143 155 255 / 0.05);
	}

	.item.off {
		opacity: 0.55;
	}

	.item :global(svg) {
		color: var(--dust-2);
		flex: none;
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: grid;
		line-height: 1.3;
	}

	.txt strong {
		font-size: 0.88rem;
		font-weight: 600;
	}

	.txt small {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		color: var(--dust-2);
		font-size: 0.77rem;
	}

	.kind {
		flex: none;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent);
	}

	.status {
		flex: none;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--dust-2);
	}

	.status.online {
		background: var(--ok);
		box-shadow: 0 0 10px var(--ok);
	}

	.status.offline {
		background: var(--danger);
		box-shadow: 0 0 10px var(--danger);
		animation: blink 1.2s ease-in-out infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0.35;
		}
	}
</style>
