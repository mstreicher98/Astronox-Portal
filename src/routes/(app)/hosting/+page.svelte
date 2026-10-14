<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Activity, Globe, Plus, RefreshCw, Repeat, ShieldCheck } from '@lucide/svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { date, daysBetween, dayOf, money, number, relative, time, today } from '$lib/shared/format';
	import { intervalOf } from '$lib/shared/stages';
	import { countUp, glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const day = today();
	let pick = $state(false);
	let customerId = $state('');

	const active = $derived(data.contracts.filter((c) => c.active));
	const mrr = $derived(active.reduce((s, c) => s + c.amountCents / intervalOf(c.interval).months, 0));
	const online = $derived(data.monitors.filter((m) => m.enabled && m.status === 'online').length);
	const offline = $derived(data.monitors.filter((m) => m.enabled && m.status === 'offline'));
</script>

<svelte:head><title>Hosting & Wartung – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Hosting & Wartung</h1>
			<p class="lead">Erreichbarkeit der Kundenseiten, Wartungsverträge und Domains.</p>
		</div>
		<div class="actions"><button class="btn" type="button" onclick={() => (pick = true)}><Plus size={16} /> Hinzufügen</button></div>
	</div>

	<div class="grid-4 stagger">
		<div class="card" use:glow style="--i: 0"><p class="small muted">Online</p><p class="v num ok">{online}<small>/{data.monitors.filter((m) => m.enabled).length}</small></p></div>
		<div class="card" use:glow style="--i: 1"><p class="small muted">Störungen</p><p class="v num" class:bad={offline.length}>{offline.length}</p></div>
		<div class="card" use:glow style="--i: 2"><p class="small muted">Verträge aktiv</p><p class="v num">{active.length}</p></div>
		<div class="card" use:glow style="--i: 3"><p class="small muted">Wiederkehrend / Monat</p><p class="v num" use:countUp={{ value: mrr, format: (n) => money(Math.round(n)) }}>€ 0</p></div>
	</div>

	<section class="card" use:glow>
		<div class="card-head"><h2><Activity size={16} /> Überwachung</h2><span class="small faint">letzte 48 Prüfungen · Verfügbarkeit 30 Tage</span></div>
		{#if data.monitors.length}
			<ul class="list mons">
				{#each data.monitors as m (m.id)}
					<li class:down={m.status === 'offline'}>
						<span class="status {m.enabled ? m.status : 'aus'}"></span>
						<div class="txt">
							<strong>{m.name}</strong>
							<small><a href={m.url} target="_blank" rel="noopener">{m.url.replace(/^https?:\/\//, '')}</a> · {m.customer ?? '–'}</small>
							{#if m.status === 'offline'}<small class="err">{m.lastError} · seit {relative(m.downSince)}</small>{/if}
						</div>
						<div class="strip" aria-label="Verlauf der letzten Prüfungen">
							{#each m.checks as c, i (c.at)}<i class:fail={!c.ok} style="--i: {i}" title="{time(c.at)} · {c.ok ? `${c.ms} ms` : c.error}"></i>{/each}
						</div>
						<div class="nums small">
							<span title="Verfügbarkeit 30 Tage">{m.uptime ? `${number(Math.round(m.uptime.pct * 100) / 100)} %` : '–'}</span>
							<span class="faint">{m.lastResponseMs != null ? `${m.lastResponseMs} ms` : ''}</span>
							{#if m.sslExpiresAt}
								{@const left = daysBetween(day, dayOf(m.sslExpiresAt))}
								<span class:warn={left < 14} title="Zertifikat gültig bis {date(dayOf(m.sslExpiresAt))}"><ShieldCheck size={12} /> {left} T</span>
							{/if}
						</div>
						<form method="POST" action="?/pruefen" use:enhance={submit()}>
							<input type="hidden" name="id" value={m.id} />
							<button class="btn quiet icon sm" type="submit" aria-label="Jetzt prüfen" title="Jetzt prüfen"><RefreshCw size={14} /></button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="small muted">Noch keine Seite überwacht. Über „Hinzufügen“ einen Kunden wählen und unter „Hosting“ eine Adresse eintragen.</p>
		{/if}
	</section>

	<div class="grid-2">
		<section class="card" use:glow>
			<div class="card-head"><h2><Repeat size={16} /> Verträge</h2><a class="small" href="/vertraege">Alle Verträge</a></div>
			<ul class="list">
				{#each data.contracts as c (c.id)}
					<li class="row-item" class:off={!c.active}>
						<a href="/kunden/{c.customerId}?tab=hosting"><strong>{c.title}</strong><small>{c.customer}</small></a>
						<span class="num small">{money(c.amountCents)} {intervalOf(c.interval).label}</span>
						<span class="small faint">{c.active ? `nächste ${relative(c.nextInvoiceDate)}` : 'beendet'}</span>
					</li>
				{:else}
					<li class="small muted">Keine Verträge.</li>
				{/each}
			</ul>
		</section>
		<section class="card" use:glow>
			<div class="card-head"><h2><Globe size={16} /> Domains</h2></div>
			<ul class="list">
				{#each data.domains as d (d.id)}
					{@const left = d.expiresOn ? daysBetween(day, d.expiresOn) : null}
					<li class="row-item">
						<a href="/kunden/{d.customerId}?tab=hosting"><strong>{d.name}</strong><small>{d.customer ?? ''}{d.registrar ? ` · ${d.registrar}` : ''}</small></a>
						<span class="small">{d.expiresOn ? date(d.expiresOn) : '–'}</span>
						{#if left != null && left < 30}<span class="badge {left < 0 ? 'danger' : 'warn'}">{left < 0 ? 'abgelaufen' : `${left} Tage`}</span>{:else}<span class="small faint">{d.autoRenew ? 'verlängert sich' : ''}</span>{/if}
					</li>
				{:else}
					<li class="small muted">Keine Domains.</li>
				{/each}
			</ul>
		</section>
	</div>
</div>

<Modal bind:open={pick} title="Für welchen Kunden?">
	<form
		class="stack"
		onsubmit={(e) => {
			e.preventDefault();
			if (customerId) void goto(`/kunden/${customerId}?tab=hosting`);
		}}
	>
		<label class="field">
			<span>Kunde</span>
			<select bind:value={customerId} required>
				<option value="">Bitte wählen …</option>
				{#each data.customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
			</select>
		</label>
		<p class="small muted">Verträge, Domains und Überwachungen werden beim Kunden (oder Projekt) unter „Hosting“ angelegt.</p>
		<div class="form-actions"><button class="btn" type="submit">Weiter</button></div>
	</form>
</Modal>

<style>
	.v {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.6rem;
	}

	.v small {
		color: var(--dust-2);
		font-size: 1rem;
	}

	.v.ok {
		color: var(--ok);
	}

	.v.bad {
		color: var(--danger);
	}

	.mons li {
		display: grid;
		grid-template-columns: 0.7rem minmax(0, 1.2fr) minmax(8rem, 1fr) auto auto;
		align-items: center;
		gap: 0.9rem;
		padding: 0.7rem 0;
	}

	.mons li.down {
		background: linear-gradient(90deg, rgb(var(--danger-rgb) / 0.07), transparent 60%);
	}

	.status {
		width: 0.65rem;
		height: 0.65rem;
		border-radius: 50%;
		background: var(--dust-2);
	}

	.status.online {
		background: var(--ok);
		box-shadow: 0 0 10px var(--ok);
	}

	.status.offline {
		background: var(--danger);
		box-shadow: 0 0 12px var(--danger);
		animation: blink 1.1s ease-in-out infinite;
	}

	.txt {
		display: grid;
		min-width: 0;
		line-height: 1.35;
	}

	.txt strong {
		font-weight: 600;
		font-size: 0.92rem;
	}

	.txt small {
		color: var(--dust-2);
		font-size: 0.78rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.txt a {
		text-decoration: none;
	}

	.txt .err {
		color: var(--danger);
	}

	/* Verlauf der letzten Prüfungen als feine Balken */
	.strip {
		display: flex;
		gap: 2px;
		height: 1.4rem;
		align-items: stretch;
	}

	.strip i {
		flex: 1;
		max-width: 5px;
		border-radius: 2px;
		background: rgb(var(--ok-rgb) / 0.65);
		animation: pop 0.4s var(--ease-out) both;
		animation-delay: calc(var(--i) * 12ms);
	}

	.strip i.fail {
		background: var(--danger);
	}

	.nums {
		display: flex;
		gap: 0.8rem;
		white-space: nowrap;
	}

	.nums span {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.nums .warn {
		color: var(--warn);
	}

	.row-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.8rem;
		padding: 0.55rem 0;
	}

	.row-item a {
		display: grid;
		line-height: 1.35;
		text-decoration: none;
	}

	.row-item a strong {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.row-item a small {
		color: var(--dust-2);
		font-size: 0.77rem;
	}

	.row-item a:hover strong {
		color: var(--accent);
	}

	.off {
		opacity: 0.5;
	}

	@keyframes blink {
		50% {
			opacity: 0.35;
		}
	}

	@keyframes pop {
		from {
			transform: scaleY(0);
		}
	}

	@media (max-width: 900px) {
		.mons li {
			grid-template-columns: 0.7rem minmax(0, 1fr) auto;
		}
		.strip {
			grid-column: 2 / -1;
		}
		.nums {
			grid-column: 2;
		}
	}
</style>
