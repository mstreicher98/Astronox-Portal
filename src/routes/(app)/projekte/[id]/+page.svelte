<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Archive,
		CalendarDays,
		Check,
		Clock,
		ExternalLink,
		FileText,
		FolderOpen,
		GitBranch,
		Globe,
		KeyRound,
		ListChecks,
		Mail,
		MessageSquarePlus,
		Phone,
		Play,
		ReceiptText,
		Server,
		Sparkles,
		Trash2,
		User
	} from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import Compose from '$lib/components/Compose.svelte';
	import CredentialsPanel from '$lib/components/CredentialsPanel.svelte';
	import FilesPanel from '$lib/components/FilesPanel.svelte';
	import HostingPanel from '$lib/components/HostingPanel.svelte';
	import MailList from '$lib/components/MailList.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import NotesPanel from '$lib/components/NotesPanel.svelte';
	import { date, dateTime, duration, money, moneyInput, relative } from '$lib/shared/format';
	import { PROJECT_KINDS, STAGES, kindLabel, stageIndex, stageOf } from '$lib/shared/stages';
	import { glow } from '$lib/ui/actions';
	import { api, submit } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';
	import Docs from './Docs.svelte';
	import Tasks from './Tasks.svelte';
	import Time from './Time.svelte';

	let { data } = $props();
	const p = $derived(data.project);
	const st = $derived(stageOf(p.stage));

	const tabs = [
		{ id: 'uebersicht', label: 'Übersicht', icon: Sparkles },
		{ id: 'aufgaben', label: 'Aufgaben', icon: ListChecks },
		{ id: 'zeit', label: 'Zeit', icon: Clock },
		{ id: 'belege', label: 'Belege', icon: ReceiptText },
		{ id: 'verlauf', label: 'Verlauf', icon: MessageSquarePlus },
		{ id: 'dateien', label: 'Dateien', icon: FolderOpen },
		{ id: 'zugaenge', label: 'Zugänge', icon: KeyRound },
		{ id: 'hosting', label: 'Hosting', icon: Server }
	] as const;
	type Tab = (typeof tabs)[number]['id'];
	let tab = $state<Tab>((page.url.searchParams.get('tab') as Tab) || 'uebersicht');

	function go(t: Tab) {
		tab = t;
		const url = new URL(page.url);
		url.searchParams.set('tab', t);
		replaceState(url, {});
	}

	const counts = $derived({
		aufgaben: data.tasks.filter((t) => !t.doneAt).length,
		belege: data.documents.length,
		dateien: data.files.length,
		zugaenge: data.credentials.length,
		hosting: data.contracts.length + data.domains.length + data.monitors.length,
		verlauf: 0,
		zeit: 0,
		uebersicht: 0
	});
	const minutes = $derived(data.times.reduce((s, t) => s + t.minutes, 0));

	let mailOpen = $state(false);
	let lostOpen = $state(false);

	async function startTimer() {
		await api('/api/zeit', { action: 'start', projectId: p.id });
		toast('Zeit läuft');
		await invalidateAll();
	}

	const mailValues = $derived({
		anrede: data.recipient?.salutationName ? `Guten Tag ${data.recipient.salutationName},` : 'Guten Tag,',
		name: data.recipient?.name ?? data.customer.name,
		projekt: p.title
	});
</script>

<svelte:head><title>{p.title} – Astronox Portal</title></svelte:head>

<div class="page">
	<header class="head" style="--c: {st.color}">
		<div class="crumbs"><a href="/projekte">Projekte</a> / <a href="/kunden/{data.customer.id}">{data.customer.name}</a></div>
		<div class="title-row">
			<div>
				<h1>{p.title}</h1>
				<p class="lead">
					<span class="badge dot" style="--c: {st.color}">{st.label}</span>
					<span>{kindLabel(p.kind)}</span>
					{#if p.valueCents}<span class="num">{money(p.valueCents)}</span>{/if}
					{#if p.dueDate}<span><CalendarDays size={14} /> bis {date(p.dueDate)}</span>{/if}
					{#if p.archivedAt}<span class="badge muted">archiviert</span>{/if}
				</p>
			</div>
			<div class="actions">
				<button class="btn ghost sm" type="button" onclick={() => (mailOpen = true)} disabled={!data.recipient}><Mail size={15} /> E-Mail</button>
				<button class="btn ghost sm" type="button" onclick={startTimer}><Play size={15} /> Zeit</button>
				<form method="POST" action="?/beleg" use:enhance={submit()}>
					<input type="hidden" name="type" value="angebot" />
					<button class="btn ghost sm" type="submit"><FileText size={15} /> Angebot</button>
				</form>
				<form method="POST" action="?/beleg" use:enhance={submit()}>
					<input type="hidden" name="type" value="rechnung" />
					<button class="btn sm" type="submit"><ReceiptText size={15} /> Rechnung</button>
				</form>
			</div>
		</div>

		<!-- Phasen als Flugbahn: Klick verschiebt das Projekt -->
		<div class="stepper" role="group" aria-label="Phase">
			{#each STAGES.filter((s) => s.id !== 'verloren') as s, i (s.id)}
				{@const done = p.stage !== 'verloren' && i <= stageIndex(p.stage)}
				<form method="POST" action="?/phase" use:enhance={submit()}>
					<input type="hidden" name="stage" value={s.id} />
					<button type="submit" class:done class:current={s.id === p.stage} style="--sc: {s.color}; --i: {i}" title={s.hint} disabled={s.id === p.stage}>
						<i>{#if done && s.id !== p.stage}<Check size={11} strokeWidth={3} />{/if}</i>
						<span>{s.label}</span>
					</button>
				</form>
			{/each}
			<button type="button" class="lost" class:current={p.stage === 'verloren'} onclick={() => (lostOpen = true)} disabled={p.stage === 'verloren'}>Verloren</button>
		</div>
	</header>

	<nav class="tabs" aria-label="Bereiche">
		{#each tabs as t (t.id)}
			<button type="button" class:on={tab === t.id} onclick={() => go(t.id)}>
				<t.icon size={15} />
				<span>{t.label}</span>
				{#if counts[t.id]}<b>{counts[t.id]}</b>{/if}
			</button>
		{/each}
	</nav>

	{#key tab}
		<div class="tab" in:fade={{ duration: 220 }}>
			{#if tab === 'uebersicht'}
				<div class="split">
					<form method="POST" action="?/speichern" class="card stack" use:glow use:enhance={submit()}>
						<div class="card-head"><h2>Projekt</h2></div>
						<div class="form-grid">
							<label class="field full"><span>Titel</span><input name="title" required value={p.title} /></label>
							<label class="field">
								<span>Kunde</span>
								<select name="customerId" value={String(p.customerId)}>
									{#each data.customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
								</select>
							</label>
							<label class="field">
								<span>Art</span>
								<select name="kind" value={p.kind}>
									{#each PROJECT_KINDS as k (k.id)}<option value={k.id}>{k.label}</option>{/each}
								</select>
							</label>
							<label class="field"><span>Wert (€, netto)</span><input name="value" inputmode="decimal" value={moneyInput(p.valueCents)} /></label>
							<label class="field"><span>Stundensatz <small>(leer = Standard {money(data.defaultRate)})</small></span><input name="hourlyRate" inputmode="decimal" value={moneyInput(p.hourlyRateCents)} /></label>
							<label class="field"><span>Start</span><input name="startDate" type="date" value={p.startDate ?? ''} /></label>
							<label class="field"><span>Fertig bis</span><input name="dueDate" type="date" value={p.dueDate ?? ''} /></label>
							<label class="field full"><span>Beschreibung</span><textarea name="description" rows="6">{p.description ?? ''}</textarea></label>
							<label class="field"><span>Live-Adresse</span><input name="liveUrl" value={p.liveUrl ?? ''} placeholder="https://…" /></label>
							<label class="field"><span>Testadresse</span><input name="stagingUrl" value={p.stagingUrl ?? ''} placeholder="https://…" /></label>
							<label class="field full"><span>Repository</span><input name="repoUrl" value={p.repoUrl ?? ''} placeholder="https://github.com/…" /></label>
						</div>
						<div class="form-actions"><button class="btn" type="submit">Speichern</button></div>
					</form>

					<div class="stack">
						<div class="card" use:glow>
							<div class="card-head"><h2><User size={16} /> Kunde</h2><a class="btn quiet sm" href="/kunden/{data.customer.id}">Öffnen</a></div>
							<p class="big">{data.customer.name}</p>
							{#if data.recipient && data.recipient.name !== data.customer.name}<p class="muted small">{data.recipient.name}</p>{/if}
							<ul class="contact small">
								{#if data.recipient?.email}<li><Mail size={14} /> <a href="mailto:{data.recipient.email}">{data.recipient.email}</a></li>{/if}
								{#if data.customer.phone}<li><Phone size={14} /> <a href="tel:{data.customer.phone}">{data.customer.phone}</a></li>{/if}
								{#if data.customer.city}<li><Globe size={14} /> {[data.customer.zip, data.customer.city].filter(Boolean).join(' ')}</li>{/if}
							</ul>
						</div>

						{#if p.liveUrl || p.stagingUrl || p.repoUrl}
							<div class="card links" use:glow>
								{#if p.liveUrl}<a href={p.liveUrl} target="_blank" rel="noopener"><Globe size={15} /> Live <ExternalLink size={12} /></a>{/if}
								{#if p.stagingUrl}<a href={p.stagingUrl} target="_blank" rel="noopener"><Sparkles size={15} /> Test <ExternalLink size={12} /></a>{/if}
								{#if p.repoUrl}<a href={p.repoUrl} target="_blank" rel="noopener"><GitBranch size={15} /> Code <ExternalLink size={12} /></a>{/if}
							</div>
						{/if}

						{#if data.inquiry}
							<div class="card origin" use:glow>
								<div class="card-head"><h2><Globe size={16} /> Anfrage über die Webseite</h2><span class="small faint">{relative(data.inquiry.createdAt)}</span></div>
								<div class="row wrap">
									{#if p.budgetLabel}<span class="chip">Budget: {p.budgetLabel}</span>{/if}
									{#if p.timeframeLabel}<span class="chip">Zeitrahmen: {p.timeframeLabel}</span>{/if}
								</div>
								<p class="prewrap quote">{data.inquiry.message}</p>
							</div>
						{/if}

						{#if data.booking}
							<div class="card" use:glow>
								<div class="card-head"><h2><CalendarDays size={16} /> Erstgespräch</h2></div>
								<p>{dateTime(data.booking.startsAt)} Uhr · {data.booking.kind === 'video' ? 'Video-Call' : 'Telefon'}</p>
								{#if data.booking.status === 'abgesagt'}<span class="badge muted">abgesagt</span>{/if}
								{#if data.booking.message}<p class="prewrap quote">{data.booking.message}</p>{/if}
							</div>
						{/if}

						<div class="card" use:glow>
							<div class="card-head"><h2><Clock size={16} /> Auf einen Blick</h2></div>
							<dl class="facts">
								<dt>Aufgaben</dt><dd>{data.tasks.filter((t) => t.doneAt).length} / {data.tasks.length} erledigt</dd>
								<dt>Zeit</dt><dd>{duration(minutes)}</dd>
								<dt>Angelegt</dt><dd>{date(p.createdAt)}</dd>
								<dt>In dieser Phase</dt><dd>seit {relative(p.stageChangedAt)}</dd>
								{#if p.lostReason}<dt>Grund</dt><dd>{p.lostReason}</dd>{/if}
							</dl>
						</div>

						<div class="row wrap danger-zone">
							<form method="POST" action="?/archivieren" use:enhance={submit()}>
								<button class="btn quiet sm" type="submit"><Archive size={14} /> {p.archivedAt ? 'Wieder aktivieren' : 'Archivieren'}</button>
							</form>
							<form method="POST" action="?/loeschen" use:enhance={submit({ confirm: 'Projekt endgültig löschen?', confirmDetail: 'Aufgaben, Zeiten, Dateien und Notizen des Projekts werden mitgelöscht.' })}>
								<button class="btn quiet sm" type="submit"><Trash2 size={14} /> Löschen</button>
							</form>
						</div>
					</div>
				</div>
			{:else if tab === 'aufgaben'}
				<Tasks tasks={data.tasks} milestones={data.milestones} templates={data.templates} />
			{:else if tab === 'zeit'}
				<Time times={data.times} defaultRate={data.defaultRate} />
			{:else if tab === 'belege'}
				<Docs documents={data.documents} />
			{:else if tab === 'verlauf'}
				<div class="split">
					<div class="card" use:glow><NotesPanel items={data.timeline} /></div>
					<div class="card" use:glow>
						<div class="card-head">
							<h2><Mail size={16} /> E-Mails</h2>
							<button class="btn ghost sm" type="button" onclick={() => (mailOpen = true)} disabled={!data.recipient}><Mail size={14} /> Schreiben</button>
						</div>
						<MailList mails={data.mails} />
					</div>
				</div>
			{:else if tab === 'dateien'}
				<div class="card" use:glow><FilesPanel files={data.files} /></div>
			{:else if tab === 'zugaenge'}
				<div class="card" use:glow><CredentialsPanel credentials={data.credentials} /></div>
			{:else if tab === 'hosting'}
				<div class="card" use:glow><HostingPanel contracts={data.contracts} domains={data.domains} monitors={data.monitors} billings={data.billings} /></div>
			{/if}
		</div>
	{/key}
</div>

<Compose bind:open={mailOpen} to={data.recipient?.email ?? ''} customerId={data.customer.id} projectId={p.id} values={mailValues} />

<Modal bind:open={lostOpen} title="Projekt als verloren markieren">
	<form method="POST" action="?/phase" class="stack" use:enhance={submit({ done: () => (lostOpen = false) })}>
		<input type="hidden" name="stage" value="verloren" />
		<label class="field">
			<span>Warum? <small>(hilft später beim Auswerten)</small></span>
			<textarea name="reason" rows="3" placeholder="z. B. Budget zu klein, anderer Anbieter, kein Bedarf mehr"></textarea>
		</label>
		<div class="form-actions"><button class="btn danger" type="submit">Als verloren markieren</button></div>
	</form>
</Modal>

<style>
	.head {
		display: grid;
		gap: 1rem;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.lead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.9rem;
		margin-top: 0.5rem;
		color: var(--dust);
		font-size: 0.9rem;
	}

	.lead span {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* ---------- Phasen-Leiste */
	.stepper {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.35rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.45);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.stepper form {
		flex: 1;
		min-width: max-content;
	}

	.stepper button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		width: 100%;
		padding: 0.4rem 0.8rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--dust-2);
		font-size: 0.8rem;
		font-weight: 550;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background-color 0.3s,
			color 0.3s;
	}

	.stepper button:hover:not(:disabled) {
		color: var(--star);
		background: rgb(255 255 255 / 0.04);
	}

	.stepper i {
		display: grid;
		place-items: center;
		width: 1rem;
		height: 1rem;
		border: 1.5px solid var(--dust-2);
		border-radius: 50%;
		color: var(--night);
		transition:
			background-color 0.3s,
			border-color 0.3s;
	}

	.stepper .done {
		color: var(--dust);
	}

	.stepper .done i {
		background: var(--sc);
		border-color: var(--sc);
	}

	.stepper .current {
		background: color-mix(in srgb, var(--sc) 16%, transparent);
		color: var(--star);
		cursor: default;
	}

	.stepper .current i {
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--sc) 25%, transparent);
		animation: pulse-ring 2s ease-out infinite;
		color: color-mix(in srgb, var(--sc) 40%, transparent);
	}

	.stepper .lost {
		flex: none;
		width: auto;
		color: var(--dust-2);
	}

	.stepper .lost.current {
		--sc: var(--dust-2);
	}

	/* ---------- Reiter */
	.tabs {
		display: flex;
		gap: 0.2rem;
		border-bottom: 1px solid var(--line-soft);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tabs button {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.65rem 0.85rem;
		border: 0;
		background: transparent;
		color: var(--dust);
		font-size: 0.87rem;
		font-weight: 550;
		white-space: nowrap;
		cursor: pointer;
	}

	.tabs button::after {
		content: '';
		position: absolute;
		left: 0.6rem;
		right: 0.6rem;
		bottom: -1px;
		height: 2px;
		border-radius: 2px;
		background: var(--grad);
		transform: scaleX(0);
		transition: transform 0.35s var(--ease-out);
	}

	.tabs button.on {
		color: var(--star);
	}

	.tabs button.on::after {
		transform: scaleX(1);
	}

	.tabs b {
		padding: 0 0.4rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.07);
		font-size: 0.7rem;
		line-height: 1.3rem;
	}

	/* ---------- Übersicht */
	.big {
		font-size: 1.05rem;
		font-weight: 600;
	}

	.contact {
		display: grid;
		gap: 0.35rem;
		margin: 0.6rem 0 0;
		padding: 0;
		list-style: none;
		color: var(--dust);
	}

	.contact li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.contact a {
		text-decoration: none;
	}

	.contact a:hover {
		color: var(--accent);
	}

	.links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.8rem;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.45rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		color: var(--dust);
		font-size: 0.85rem;
		text-decoration: none;
	}

	.links a:hover {
		border-color: var(--accent);
		color: var(--star);
	}

	.quote {
		margin-top: 0.7rem;
		padding: 0.7rem 0.85rem;
		border-left: 2px solid var(--accent);
		border-radius: 0 10px 10px 0;
		background: rgb(7 13 36 / 0.45);
		color: var(--dust);
		font-size: 0.88rem;
	}

	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.35rem 1rem;
		margin: 0;
		font-size: 0.88rem;
	}

	.facts dt {
		color: var(--dust-2);
	}

	.facts dd {
		margin: 0;
	}

	.danger-zone {
		justify-content: flex-end;
	}

	@media (max-width: 760px) {
		.stepper span {
			display: none;
		}
		.stepper .current span,
		.stepper .lost {
			display: inline;
		}
	}
</style>
