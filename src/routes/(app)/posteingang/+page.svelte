<script lang="ts">
	import { enhance } from '$app/forms';
	import { CheckCheck, CircleAlert, Inbox, Paperclip, PenLine, RefreshCw, Send, Settings } from '@lucide/svelte';
	import Compose from '$lib/components/Compose.svelte';
	import { relative } from '$lib/shared/format';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	let composeOpen = $state(false);

	const views = $derived([
		['eingang', 'Eingang', 0],
		['offen', 'Nicht zugeordnet', data.unassigned],
		['gesendet', 'Gesendet', 0],
		['ignoriert', 'Ausgeblendet', 0]
	] as const);
</script>

<svelte:head><title>Posteingang – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Posteingang</h1>
			<p class="lead">
				{#if data.imap.enabled}
					office@astronox.dev · zuletzt abgerufen {relative(data.imap.lastSync)}
					{#if data.imap.lastError}<span class="err"><CircleAlert size={14} /> {data.imap.lastError}</span>{/if}
				{:else}
					Das Postfach ist noch nicht verbunden – <a href="/einstellungen/email">jetzt einrichten</a>. Gesendete Mails erscheinen trotzdem hier.
				{/if}
			</p>
		</div>
		<div class="actions">
			<form method="POST" action="?/alle_gelesen" use:enhance={submit()}><button class="btn quiet sm" type="submit"><CheckCheck size={15} /> Alle gelesen</button></form>
			{#if data.imap.enabled}
				<form method="POST" action="?/abrufen" use:enhance={submit()}><button class="btn ghost sm" type="submit"><RefreshCw size={15} /> Abrufen</button></form>
			{:else}
				<a class="btn ghost sm" href="/einstellungen/email"><Settings size={15} /> Einrichten</a>
			{/if}
			<button class="btn sm" type="button" onclick={() => (composeOpen = true)}><PenLine size={15} /> Neue Mail</button>
		</div>
	</div>

	<nav class="tabs-inline">
		{#each views as [id, label, n] (id)}
			<a href="?ansicht={id}" class:on={data.view === id}>{label}{#if n}<b>{n}</b>{/if}</a>
		{/each}
	</nav>

	<div class="card flush">
		{#if data.mails.length}
			<ul class="list mails">
				{#each data.mails as m, i (m.id)}
					{@const att = JSON.parse(m.attachments || '[]').length}
					<li style="--i: {i}">
						<a href="/posteingang/{m.id}" class:unread={m.direction === 'ein' && !m.seen}>
							<span class="dot" aria-hidden="true"></span>
							<span class="from">
								{#if m.direction === 'aus'}<Send size={13} /> {m.toAddrs}{:else}{m.fromName || m.fromAddr}{/if}
								{#if m.status === 'fehler'}<span class="badge danger">nicht gesendet</span>{/if}
							</span>
							<span class="body">
								<strong>{m.subject}</strong>
								<small>{m.snippet}</small>
							</span>
							<span class="meta">
								{#if m.customer}<span class="chip">{m.project ?? m.customer}</span>{:else if m.direction === 'ein'}<span class="chip new">neu</span>{/if}
								{#if att}<Paperclip size={13} />{/if}
								<time>{relative(m.date)}</time>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="empty">
				<Inbox size={30} />
				<p>{data.view === 'offen' ? 'Alles zugeordnet.' : 'Keine Mails.'}</p>
			</div>
		{/if}
	</div>
</div>

<Compose bind:open={composeOpen} />

<style>
	.err {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: 0.5rem;
		color: var(--danger);
	}

	.lead a {
		color: var(--accent);
	}

	.tabs-inline {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.2rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.45);
		justify-self: start;
	}

	.tabs-inline a {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		color: var(--dust);
		font-size: 0.85rem;
		text-decoration: none;
	}

	.tabs-inline a.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	.tabs-inline b {
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--accent-soft);
		color: var(--accent);
		font-size: 0.7rem;
	}

	.mails li {
		animation: rise 0.4s var(--ease-out) both;
		animation-delay: calc(min(var(--i), 15) * 25ms);
	}

	.mails a {
		display: grid;
		grid-template-columns: 0.6rem 13rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.9rem;
		padding: 0.75rem 1.25rem;
		text-decoration: none;
		transition: background-color 0.2s;
	}

	.mails a:hover {
		background: rgb(143 155 255 / 0.05);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
	}

	.unread .dot {
		background: var(--accent);
		box-shadow: 0 0 8px var(--accent);
	}

	.from {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 0.88rem;
		color: var(--dust);
	}

	.unread .from,
	.unread strong {
		color: var(--star);
		font-weight: 700;
	}

	.body {
		display: grid;
		min-width: 0;
		line-height: 1.35;
	}

	.body strong {
		font-weight: 500;
		font-size: 0.9rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.body small {
		color: var(--dust-2);
		font-size: 0.8rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--dust-2);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.chip.new {
		border-color: rgb(var(--accent-rgb) / 0.4);
		color: var(--accent);
	}

	@media (max-width: 760px) {
		.mails a {
			grid-template-columns: 0.6rem minmax(0, 1fr) auto;
		}
		.from {
			grid-column: 2;
		}
		.body {
			grid-column: 2 / -1;
			grid-row: 2;
		}
		.meta .chip {
			display: none;
		}
	}
</style>
