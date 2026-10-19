<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { CheckCheck, CircleAlert, EyeOff, Inbox, Mail, MailOpen, Paperclip, PenLine, RefreshCw, Send, Settings, Trash2, UserX } from '@lucide/svelte';
	import Compose from '$lib/components/Compose.svelte';
	import { initials, relative } from '$lib/shared/format';
	import { avatarColor, groupByDay, listTime } from '$lib/shared/inbox';
	import { submit } from '$lib/ui/form';

	/**
	 * Posteingang wie in Outlook: Ordner | Liste nach Datum | Lesebereich.
	 * Schmaler wandern die Ordner über die Liste, am Handy gibt es Liste oder Mail.
	 */

	let { data, children } = $props();
	let composeOpen = $state(false);
	let onlyUnread = $state(false);

	const openId = $derived(page.params.id ? Number(page.params.id) : null);
	const folders = $derived([
		{ id: 'eingang', label: 'Posteingang', icon: Inbox, n: data.counts.unread },
		{ id: 'offen', label: 'Nicht zugeordnet', icon: UserX, n: data.counts.unassigned },
		{ id: 'gesendet', label: 'Gesendet', icon: Send, n: 0 },
		{ id: 'ignoriert', label: 'Ausgeblendet', icon: EyeOff, n: 0 }
	]);
	const folder = $derived(folders.find((f) => f.id === data.view) ?? folders[0]);

	type Row = (typeof data.mails)[number];
	// Die offene Mail gilt sofort als gelesen – der Server merkt es sich beim Öffnen
	const isUnread = (m: Row) => m.direction === 'ein' && !m.seen && m.id !== openId;
	const shown = $derived(onlyUnread ? data.mails.filter((m) => isUnread(m) || m.id === openId) : data.mails);
	const groups = $derived(groupByDay(shown));
</script>

<div class="mailapp" class:reading={openId !== null}>
	<aside class="folders" aria-label="Ordner">
		<button class="btn wide" type="button" onclick={() => (composeOpen = true)}><PenLine size={15} /> Neue E-Mail</button>
		<nav>
			{#each folders as f (f.id)}
				<a href="/posteingang?ansicht={f.id}" class:on={data.view === f.id} aria-current={data.view === f.id ? 'page' : undefined}>
					<f.icon size={17} />
					<span>{f.label}</span>
					{#if f.n}<b>{f.n}</b>{/if}
				</a>
			{/each}
		</nav>
		<div class="sync small">
			{#if data.imap.enabled}
				<span class="faint">office@astronox.dev</span>
				<span>Abgerufen {relative(data.imap.lastSync)}</span>
				{#if data.imap.lastError}<span class="err"><CircleAlert size={13} /> {data.imap.lastError}</span>{/if}
			{:else}
				<a href="/einstellungen/email"><Settings size={14} /> Postfach verbinden</a>
			{/if}
		</div>
	</aside>

	<section class="listpane" aria-label="Mails">
		<header class="list-head">
			<div class="title-row">
				<h1>{folder.label}</h1>
				<div class="tools">
					<form method="POST" action="/posteingang?/alle_gelesen" use:enhance={submit()}>
						<button class="btn quiet sm icon" type="submit" title="Alle als gelesen markieren" aria-label="Alle als gelesen markieren"><CheckCheck size={17} /></button>
					</form>
					{#if data.imap.enabled}
						<form method="POST" action="/posteingang?/abrufen" use:enhance={submit()}>
							<button class="btn quiet sm icon" type="submit" title="Jetzt abrufen" aria-label="Jetzt abrufen"><RefreshCw size={16} /></button>
						</form>
					{/if}
					<button class="btn sm icon compose-sm" type="button" title="Neue E-Mail" aria-label="Neue E-Mail" onclick={() => (composeOpen = true)}><PenLine size={16} /></button>
				</div>
			</div>
			<nav class="folder-tabs" aria-label="Ordner">
				{#each folders as f (f.id)}
					<a href="/posteingang?ansicht={f.id}" class:on={data.view === f.id}>{f.label}{#if f.n}<b>{f.n}</b>{/if}</a>
				{/each}
			</nav>
			{#if data.view !== 'gesendet'}
				<div class="filter" role="group" aria-label="Filter">
					<button type="button" class:on={!onlyUnread} aria-pressed={!onlyUnread} onclick={() => (onlyUnread = false)}>Alle</button>
					<button type="button" class:on={onlyUnread} aria-pressed={onlyUnread} onclick={() => (onlyUnread = true)}>Ungelesen</button>
				</div>
			{/if}
		</header>

		<div class="scroll">
			{#each groups as g (g.label)}
				<h2 class="group">{g.label}</h2>
				<ul>
					{#each g.mails as m (m.id)}
						{@const unread = isUnread(m)}
						{@const open = m.id === openId}
						{@const who = m.direction === 'aus' ? m.toAddrs : m.fromName || m.fromAddr}
						{@const att = JSON.parse(m.attachments || '[]').length}
						<!-- Empfangene Mails aus dem Postfach landen dort im Papierkorb – nur sonst nachfragen -->
						{@const recoverable = m.direction === 'ein' && !!m.inMailbox && data.imap.enabled}
						<li>
							<a class="item" class:unread class:open href="/posteingang/{m.id}?ansicht={data.view}" aria-current={open ? 'true' : undefined}>
								<span class="avatar" style="--c: {avatarColor(m.direction === 'aus' ? m.toAddrs : m.fromAddr)}" aria-hidden="true">{initials(who) || '?'}</span>
								<span class="lines">
									<span class="l1">
										<span class="who">{#if m.direction === 'aus'}<Send size={12} />{/if}{who}</span>
										<time datetime={m.date}>{listTime(m.date)}</time>
									</span>
									<span class="l2">
										<span class="subj">{m.subject}</span>
										{#if att}<Paperclip size={13} />{/if}
										{#if m.status === 'fehler'}<span class="badge danger">nicht gesendet</span>{/if}
									</span>
									<span class="l3">
										<span class="snip">{m.snippet || '(kein Text)'}</span>
										{#if m.customer}<span class="chip">{m.project ?? m.customer}</span>{/if}
									</span>
								</span>
							</a>
							<div class="row-actions">
								{#if m.direction === 'ein'}
									{#if open}
										<!-- über die Mail selbst: bliebe sie offen, wäre sie beim Neuladen gleich wieder gelesen -->
										<form method="POST" action="/posteingang/{m.id}?/ungelesen" use:enhance={submit()}>
											<input type="hidden" name="ansicht" value={data.view} />
											<button class="btn quiet sm icon" type="submit" title="Als ungelesen markieren" aria-label="Als ungelesen markieren"><Mail size={15} /></button>
										</form>
									{:else}
										<form method="POST" action="/posteingang?/gelesen" use:enhance={submit()}>
											<input type="hidden" name="id" value={m.id} />
											<input type="hidden" name="seen" value={unread ? 'ja' : ''} />
											<button class="btn quiet sm icon" type="submit" title={unread ? 'Als gelesen markieren' : 'Als ungelesen markieren'} aria-label={unread ? 'Als gelesen markieren' : 'Als ungelesen markieren'}>
												{#if unread}<MailOpen size={15} />{:else}<Mail size={15} />{/if}
											</button>
										</form>
									{/if}
								{/if}
								<form
									method="POST"
									action={open ? `/posteingang/${m.id}?/loeschen` : '/posteingang?/loeschen'}
									use:enhance={submit(
										recoverable
											? {}
											: { confirm: 'Mail löschen?', confirmDetail: m.direction === 'aus' ? 'Nur im Portal – die Kopie in deinem Postfach bleibt.' : 'Sie ist danach endgültig weg.' }
									)}
								>
									<input type="hidden" name="id" value={m.id} />
									<input type="hidden" name="ansicht" value={data.view} />
									<button class="btn quiet sm icon del" type="submit" title="Löschen" aria-label="Löschen"><Trash2 size={15} /></button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="empty">
					<Inbox size={28} />
					<p>{onlyUnread ? 'Keine ungelesenen Mails.' : data.view === 'offen' ? 'Alles zugeordnet.' : 'Keine Mails.'}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="readpane">
		{@render children()}
	</section>
</div>

<Compose bind:open={composeOpen} />

<style>
	.mailapp {
		display: grid;
		grid-template-columns: 14rem minmax(21rem, 27rem) minmax(0, 1fr);
		height: calc(100svh - var(--topbar));
		/* backwards statt both: eine dauerhaft „laufende“ Animation würde Fenster wie
		   „Antworten“ (position: fixed) in diesen Bereich einsperren */
		animation: page-in 0.55s var(--ease-out) backwards;
	}

	/* ------------------------------------------------------------ Ordner */
	.folders {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		padding: 1rem 0.75rem;
		border-right: 1px solid var(--line-soft);
		overflow-y: auto;
	}

	.wide {
		width: 100%;
	}

	.folders nav {
		display: grid;
		gap: 0.15rem;
	}

	.folders nav a {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.7rem;
		border-radius: 10px;
		color: var(--dust);
		font-size: 0.9rem;
		text-decoration: none;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.folders nav a:hover {
		background: rgb(143 155 255 / 0.06);
		color: var(--star);
	}

	.folders nav a.on {
		background: var(--nebula-soft);
		color: var(--star);
		font-weight: 600;
	}

	.folders nav b {
		margin-left: auto;
		color: var(--accent);
		font-size: 0.78rem;
	}

	.sync {
		display: grid;
		gap: 0.2rem;
		margin-top: auto;
		padding: 0.75rem 0.5rem 0;
		border-top: 1px solid var(--line-soft);
		color: var(--dust-2);
		overflow-wrap: anywhere;
	}

	.sync a {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--accent);
	}

	.err {
		display: flex;
		align-items: flex-start;
		gap: 0.3rem;
		color: var(--danger);
	}

	/* ------------------------------------------------------------- Liste */
	.listpane {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-right: 1px solid var(--line-soft);
		background: rgb(7 13 36 / 0.35);
	}

	.list-head {
		display: grid;
		gap: 0.65rem;
		padding: 1rem 1rem 0;
		border-bottom: 1px solid var(--line-soft);
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.title-row h1 {
		font-size: 1.3rem;
	}

	.tools {
		display: flex;
		gap: 0.15rem;
	}

	.compose-sm,
	.folder-tabs {
		display: none;
	}

	/* Unterstrichene Reiter wie „Fokussiert | Sonstige“ */
	.filter {
		display: flex;
		gap: 1.1rem;
	}

	.filter button {
		padding: 0.25rem 0 0.55rem;
		border: 0;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--dust);
		font-size: 0.85rem;
		cursor: pointer;
	}

	.filter button.on {
		border-color: var(--accent);
		color: var(--star);
		font-weight: 600;
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.group {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0.5rem 1rem 0.35rem;
		background: rgb(11 19 48 / 0.94);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		color: var(--dust);
		font-family: var(--font-body);
		font-size: 0.76rem;
		font-stretch: 100%;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	li {
		position: relative;
	}

	.item {
		position: relative;
		display: grid;
		grid-template-columns: 2.1rem minmax(0, 1fr);
		gap: 0.7rem;
		padding: 0.65rem 1rem 0.7rem 0.95rem;
		border-bottom: 1px solid rgb(39 50 95 / 0.35);
		color: inherit;
		text-decoration: none;
		transition: background-color 0.15s;
	}

	/* Balken links wie in Outlook: ungelesen bzw. gerade offen */
	.item::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: 3px;
	}

	.item:hover {
		background: rgb(143 155 255 / 0.06);
	}

	.item.unread::before {
		background: var(--accent);
		box-shadow: 0 0 10px rgb(var(--accent-rgb) / 0.6);
	}

	.item.open {
		background: var(--nebula-soft);
	}

	.item.open::before {
		background: var(--nebula);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--c) 20%, transparent);
		color: var(--c);
		font-size: 0.74rem;
		font-weight: 700;
	}

	.lines {
		display: grid;
		gap: 0.08rem;
		min-width: 0;
	}

	.l1,
	.l2,
	.l3 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.who,
	.subj,
	.snip {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--star);
		font-size: 0.9rem;
	}

	.subj {
		color: var(--dust);
		font-size: 0.84rem;
	}

	.snip {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	time {
		flex: none;
		color: var(--dust-2);
		font-size: 0.74rem;
		transition: opacity 0.15s;
	}

	.l2 :global(svg) {
		flex: none;
		color: var(--dust-2);
	}

	.l3 .chip {
		flex: none;
		max-width: 9rem;
		padding: 0 0.45rem;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 0.68rem;
	}

	.unread .who {
		font-weight: 700;
	}

	.unread .subj,
	.unread time {
		color: var(--accent);
		font-weight: 600;
	}

	/* Gelesen/Löschen erscheinen beim Darüberfahren an der Stelle der Zeit */
	.row-actions {
		position: absolute;
		top: 0.45rem;
		right: 0.6rem;
		display: flex;
		gap: 0.1rem;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s;
	}

	.row-actions .btn {
		--h: 1.8rem;
	}

	li:hover .row-actions,
	li:focus-within .row-actions {
		opacity: 1;
		pointer-events: auto;
	}

	li:hover time,
	li:focus-within time {
		opacity: 0;
	}

	.del:hover {
		color: var(--danger);
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 0.5rem;
		padding: 3rem 1rem;
		color: var(--dust-2);
	}

	/* ------------------------------------------------------- Lesebereich */
	/* Container: die Mail richtet sich nach der Breite des Lesebereichs, nicht des Fensters */
	.readpane {
		min-width: 0;
		min-height: 0;
		overflow-y: auto;
		container-type: inline-size;
	}

	/* Ohne Maus: Knöpfe unten rechts immer sichtbar */
	@media (hover: none) {
		.row-actions {
			top: auto;
			bottom: 0.45rem;
			opacity: 1;
			pointer-events: auto;
		}
		.l3 {
			padding-right: 4.2rem;
		}
		li:hover time,
		li:focus-within time {
			opacity: 1;
		}
	}

	/* Schmaler: Ordner als Reiter über der Liste */
	@media (max-width: 1400px) {
		.mailapp {
			grid-template-columns: minmax(20rem, 25rem) minmax(0, 1fr);
		}
		.folders {
			display: none;
		}
		.compose-sm {
			display: inline-grid;
		}
		.folder-tabs {
			display: flex;
			gap: 0.3rem;
			overflow-x: auto;
			scrollbar-width: none;
		}
		.folder-tabs a {
			display: inline-flex;
			flex: none;
			align-items: center;
			gap: 0.35rem;
			padding: 0.3rem 0.7rem;
			border: 1px solid var(--line-soft);
			border-radius: 999px;
			color: var(--dust);
			font-size: 0.8rem;
			text-decoration: none;
		}
		.folder-tabs a.on {
			border-color: transparent;
			background: var(--nebula-soft);
			color: var(--star);
		}
		.folder-tabs b {
			color: var(--accent);
			font-size: 0.72rem;
		}
	}

	/* Handy: entweder Liste oder Mail */
	@media (max-width: 960px) {
		.mailapp {
			display: block;
			height: auto;
			padding-bottom: 5rem;
		}
		.listpane {
			border-right: 0;
			background: none;
		}
		.scroll {
			overflow: visible;
		}
		.group {
			top: var(--topbar);
		}
		.mailapp.reading .listpane,
		.mailapp:not(.reading) .readpane {
			display: none;
		}
		.readpane {
			overflow: visible;
		}
	}
</style>
