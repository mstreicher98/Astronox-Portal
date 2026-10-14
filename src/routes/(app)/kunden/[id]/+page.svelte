<script lang="ts">
	import { enhance } from '$app/forms';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { Archive, Building2, CalendarDays, FileText, FolderKanban, FolderOpen, KeyRound, Mail, MessageSquarePlus, Pencil, Phone, Plus, ReceiptText, Server, Sparkles, Star, Trash2, User, UserPlus } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import Compose from '$lib/components/Compose.svelte';
	import CredentialsPanel from '$lib/components/CredentialsPanel.svelte';
	import CustomerFields from '$lib/components/CustomerFields.svelte';
	import FilesPanel from '$lib/components/FilesPanel.svelte';
	import HostingPanel from '$lib/components/HostingPanel.svelte';
	import MailList from '$lib/components/MailList.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import NewProject from '$lib/components/NewProject.svelte';
	import NotesPanel from '$lib/components/NotesPanel.svelte';
	import type { Contact } from '$lib/server/db/schema';
	import { date, dateTime, initials, money, relative } from '$lib/shared/format';
	import { DOC_STATUS, kindLabel, stageOf } from '$lib/shared/stages';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const c = $derived(data.customer);

	const tabs = [
		{ id: 'uebersicht', label: 'Übersicht', icon: Sparkles },
		{ id: 'verlauf', label: 'Verlauf', icon: MessageSquarePlus },
		{ id: 'belege', label: 'Belege', icon: ReceiptText },
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

	let editOpen = $state(false);
	let contactOpen = $state(false);
	let contact = $state<Contact | null>(null);
	let mailOpen = $state(false);
	let projectOpen = $state(false);

	const revenue = $derived(data.documents.filter((d) => d.type === 'rechnung' && ['offen', 'bezahlt'].includes(d.status)).reduce((s, d) => s + d.netCents, 0));
	const openAmount = $derived(data.documents.filter((d) => d.type === 'rechnung' && d.status === 'offen').reduce((s, d) => s + d.grossCents, 0));
	const mailValues = $derived({ anrede: data.recipient?.salutationName ? `Guten Tag ${data.recipient.salutationName},` : 'Guten Tag,', name: data.recipient?.name ?? c.name });
</script>

<svelte:head><title>{c.name} – Astronox Portal</title></svelte:head>

<div class="page">
	<header class="head">
		<div class="crumbs"><a href="/kunden">Kunden</a> / {c.name}</div>
		<div class="title-row">
			<div class="who">
				<span class="av">{initials(c.name)}</span>
				<div>
					<h1>{c.name}</h1>
					<p class="lead">
						<span>{#if c.kind === 'firma'}<Building2 size={14} /> Firma{:else}<User size={14} /> Privat{/if}</span>
						{#if c.city}<span>{[c.zip, c.city].filter(Boolean).join(' ')}</span>{/if}
						<span>seit {date(c.createdAt)}</span>
						{#if c.source !== 'manuell'}<span class="badge accent">über {c.source === 'webseite' ? 'Anfrage' : c.source === 'termin' ? 'Terminbuchung' : c.source}</span>{/if}
						{#if c.archivedAt}<span class="badge muted">archiviert</span>{/if}
					</p>
				</div>
			</div>
			<div class="actions">
				<button class="btn ghost sm" type="button" onclick={() => (mailOpen = true)} disabled={!data.recipient}><Mail size={15} /> E-Mail</button>
				<button class="btn ghost sm" type="button" onclick={() => (editOpen = true)}><Pencil size={15} /> Bearbeiten</button>
				<form method="POST" action="?/beleg" use:enhance={submit()}><input type="hidden" name="type" value="angebot" /><button class="btn ghost sm" type="submit"><FileText size={15} /> Angebot</button></form>
				<button class="btn sm" type="button" onclick={() => (projectOpen = true)}><Plus size={15} /> Projekt</button>
			</div>
		</div>
	</header>

	<nav class="tabs" aria-label="Bereiche">
		{#each tabs as t (t.id)}
			<button type="button" class:on={tab === t.id} onclick={() => go(t.id)}><t.icon size={15} /> {t.label}</button>
		{/each}
	</nav>

	{#key tab}
		<div in:fade={{ duration: 220 }}>
			{#if tab === 'uebersicht'}
				<div class="split">
					<div class="stack">
						<div class="grid-3">
							<div class="card"><p class="small muted">Umsatz netto</p><p class="v num">{money(revenue)}</p></div>
							<div class="card"><p class="small muted">Offen</p><p class="v num">{money(openAmount)}</p></div>
							<div class="card"><p class="small muted">Projekte</p><p class="v num">{data.projects.length}</p></div>
						</div>

						<div class="card flush" use:glow>
							<div class="card-head"><h2><FolderKanban size={16} /> Projekte</h2></div>
							{#if data.projects.length}
								<ul class="list rows">
									{#each data.projects as p (p.id)}
										{@const st = stageOf(p.stage)}
										<li>
											<a href="/projekte/{p.id}">
												<span class="badge dot" style="--c: {st.color}">{st.label}</span>
												<strong>{p.title}</strong>
												<small class="muted">{kindLabel(p.kind)}</small>
												<span class="num small">{p.valueCents ? money(p.valueCents) : ''}</span>
											</a>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="pad muted small">Noch keine Projekte.</p>
							{/if}
						</div>

						{#if data.bookings.length}
							<div class="card" use:glow>
								<div class="card-head"><h2><CalendarDays size={16} /> Termine</h2></div>
								<ul class="list">
									{#each data.bookings as b (b.id)}
										<li class="spread small" style="padding: 0.45rem 0">
											<span>{dateTime(b.startsAt)} · {b.kind === 'video' ? 'Video-Call' : 'Telefon'}</span>
											{#if b.status === 'abgesagt'}<span class="badge muted">abgesagt</span>{:else if Date.parse(b.startsAt) > Date.now()}<span class="badge info">{relative(b.startsAt)}</span>{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						<form method="POST" action="?/notizen" class="card stack" use:glow use:enhance={submit()}>
							<div class="card-head"><h2>Notizen zum Kunden</h2></div>
							<textarea class="input" name="notes" rows="4" placeholder="Was man über diesen Kunden wissen sollte …">{c.notes ?? ''}</textarea>
							<div class="form-actions"><button class="btn ghost sm" type="submit">Speichern</button></div>
						</form>
					</div>

					<div class="stack">
						<div class="card" use:glow>
							<div class="card-head"><h2><User size={16} /> Kontakt</h2></div>
							<ul class="contact small">
								{#if c.email}<li><Mail size={14} /> <a href="mailto:{c.email}">{c.email}</a></li>{/if}
								{#if c.phone}<li><Phone size={14} /> <a href="tel:{c.phone}">{c.phone}</a></li>{/if}
								{#if c.street}<li><Building2 size={14} /> {c.street}, {[c.zip, c.city].filter(Boolean).join(' ')}</li>{/if}
								{#if c.website}<li><Sparkles size={14} /> <a href={c.website} target="_blank" rel="noopener">{c.website.replace(/^https?:\/\//, '')}</a></li>{/if}
								{#if c.vatId}<li>UID {c.vatId}</li>{/if}
							</ul>
							{#if !c.street}<p class="small faint" style="margin-top: 0.5rem">Für Rechnungen fehlt noch die Anschrift.</p>{/if}
						</div>

						<div class="card" use:glow>
							<div class="card-head">
								<h2><UserPlus size={16} /> Ansprechpersonen</h2>
								<button
									class="btn quiet sm"
									type="button"
									onclick={() => {
										contact = null;
										contactOpen = true;
									}}><Plus size={14} /> Person</button
								>
							</div>
							{#each data.contacts as p (p.id)}
								<button
									type="button"
									class="person"
									onclick={() => {
										contact = p;
										contactOpen = true;
									}}
								>
									<span class="pav">{initials(p.name)}</span>
									<span class="ptxt">
										<strong>{p.name} {#if p.isPrimary}<Star size={11} fill="currentColor" />{/if}</strong>
										<small>{[p.role, p.email, p.phone].filter(Boolean).join(' · ')}</small>
									</span>
								</button>
							{:else}
								<p class="small faint">Keine Ansprechpersonen.</p>
							{/each}
						</div>

						<div class="row wrap" style="justify-content: flex-end">
							<form method="POST" action="?/archivieren" use:enhance={submit()}><button class="btn quiet sm" type="submit"><Archive size={14} /> {c.archivedAt ? 'Wieder aktivieren' : 'Archivieren'}</button></form>
							<form method="POST" action="?/loeschen" use:enhance={submit({ confirm: `${c.name} endgültig löschen?` })}><button class="btn quiet sm" type="submit"><Trash2 size={14} /> Löschen</button></form>
						</div>
					</div>
				</div>
			{:else if tab === 'verlauf'}
				<div class="split">
					<div class="card" use:glow><NotesPanel items={data.timeline} context /></div>
					<div class="card" use:glow>
						<div class="card-head"><h2><Mail size={16} /> E-Mails</h2><button class="btn ghost sm" type="button" onclick={() => (mailOpen = true)} disabled={!data.recipient}>Schreiben</button></div>
						<MailList mails={data.mails} />
					</div>
				</div>
			{:else if tab === 'belege'}
				<div class="card flush">
					<div class="card-head">
						<h2>Angebote & Rechnungen</h2>
						<div class="row">
							<form method="POST" action="?/beleg" use:enhance={submit()}><input type="hidden" name="type" value="angebot" /><button class="btn ghost sm" type="submit">Angebot</button></form>
							<form method="POST" action="?/beleg" use:enhance={submit()}><input type="hidden" name="type" value="rechnung" /><button class="btn ghost sm" type="submit">Rechnung</button></form>
						</div>
					</div>
					<div class="table-wrap">
						<table class="table">
							<thead><tr><th>Nummer</th><th>Titel</th><th>Datum</th><th class="right">Betrag</th><th>Status</th></tr></thead>
							<tbody>
								{#each data.documents as d (d.id)}
									<tr>
										<td><a class="rowlink mono" href="/rechnungen/{d.id}">{d.number ?? 'Entwurf'}</a></td>
										<td>{d.type === 'angebot' ? 'Angebot' : 'Rechnung'}: {d.title}</td>
										<td class="small">{date(d.issueDate)}</td>
										<td class="right num">{money(d.grossCents)}</td>
										<td><span class="badge {DOC_STATUS[d.status].tone}">{DOC_STATUS[d.status].label}</span></td>
									</tr>
								{:else}
									<tr><td colspan="5" class="muted">Noch keine Belege.</td></tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else if tab === 'dateien'}
				<div class="card" use:glow><FilesPanel files={data.files} /></div>
			{:else if tab === 'zugaenge'}
				<div class="card" use:glow><CredentialsPanel credentials={data.credentials} /></div>
			{:else if tab === 'hosting'}
				<div class="card" use:glow><HostingPanel contracts={data.contracts} domains={data.domains} monitors={data.monitors} billings={data.billings} projects={data.projects.map((p) => ({ id: p.id, title: p.title }))} /></div>
			{/if}
		</div>
	{/key}
</div>

<Modal bind:open={editOpen} title="Kunde bearbeiten" wide>
	<form method="POST" action="?/speichern" class="stack" use:enhance={submit({ done: () => (editOpen = false) })}>
		<CustomerFields customer={c} />
		<div class="form-actions"><button class="btn" type="submit">Speichern</button></div>
	</form>
</Modal>

<Modal bind:open={contactOpen} title={contact ? 'Ansprechperson bearbeiten' : 'Neue Ansprechperson'}>
	<form method="POST" action="?/kontakt" class="stack" use:enhance={submit({ done: () => (contactOpen = false) })}>
		{#if contact}<input type="hidden" name="id" value={contact.id} />{/if}
		<div class="form-grid">
			<label class="field"><span>Name</span><input name="name" required value={contact?.name ?? ''} /></label>
			<label class="field"><span>Funktion</span><input name="role" value={contact?.role ?? ''} placeholder="z. B. Geschäftsführung" /></label>
			<label class="field"><span>E-Mail</span><input name="email" type="email" value={contact?.email ?? ''} /></label>
			<label class="field"><span>Telefon</span><input name="phone" type="tel" value={contact?.phone ?? ''} /></label>
		</div>
		<label class="check"><input type="checkbox" name="isPrimary" checked={contact?.isPrimary ?? !data.contacts.length} /> Hauptkontakt (bekommt Angebote und Rechnungen)</label>
		<div class="form-actions">
			{#if contact}<button class="btn danger" type="submit" formaction="?/kontakt_loeschen" formnovalidate>Entfernen</button>{/if}
			<button class="btn" type="submit">Speichern</button>
		</div>
	</form>
</Modal>

<Compose bind:open={mailOpen} to={data.recipient?.email ?? ''} customerId={c.id} values={mailValues} />
<NewProject bind:open={projectOpen} customers={[]} customerId={c.id} />

<style>
	.head {
		display: grid;
		gap: 0.5rem;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.av {
		display: grid;
		place-items: center;
		width: 3.4rem;
		height: 3.4rem;
		border-radius: 18px;
		background: var(--grad);
		color: var(--night);
		font-family: var(--font-display);
		font-weight: 760;
		font-size: 1.1rem;
		box-shadow: 0 10px 40px -10px rgb(143 155 255 / 0.7);
	}

	.lead {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.9rem;
		margin-top: 0.4rem;
		color: var(--dust);
		font-size: 0.88rem;
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

	.v {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.3rem;
	}

	.rows a {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1.25rem;
		text-decoration: none;
	}

	.rows a:hover {
		background: rgb(143 155 255 / 0.05);
	}

	.rows strong {
		flex: 1;
		font-weight: 600;
		font-size: 0.9rem;
	}

	.pad {
		padding: 0.5rem 1.25rem 1.25rem;
	}

	.contact {
		display: grid;
		gap: 0.4rem;
		margin: 0;
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

	.person {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.5rem 0.3rem;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.person:hover {
		background: rgb(143 155 255 / 0.06);
	}

	.pav {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--nebula-soft);
		color: var(--nebula);
		font-size: 0.72rem;
		font-weight: 700;
	}

	.ptxt {
		display: grid;
		line-height: 1.3;
	}

	.ptxt strong {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.88rem;
	}

	.ptxt strong :global(svg) {
		color: var(--warn);
	}

	.ptxt small {
		color: var(--dust-2);
		font-size: 0.77rem;
	}
</style>
