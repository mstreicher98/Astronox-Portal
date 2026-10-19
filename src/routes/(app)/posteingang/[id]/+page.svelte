<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { ArrowLeft, EyeOff, Forward, Link2, Mail, MessagesSquare, Paperclip, Reply, Trash2, UserPlus } from '@lucide/svelte';
	import Compose from '$lib/components/Compose.svelte';
	import { bytes, dateTime, initials } from '$lib/shared/format';
	import { avatarColor, listTime } from '$lib/shared/inbox';
	import { submit } from '$lib/ui/form';

	/** Lesebereich rechts neben der Liste (wie Outlook) – am Handy eine eigene Seite */

	let { data } = $props();
	const m = $derived(data.mail);
	let mode = $state<'text' | 'html'>('html');
	let replyOpen = $state(false);
	let forward = $state(false);
	let customerId = $state('');
	let editAssign = $state(false);

	// Nur beim Wechsel der Mail zurücksetzen – nicht, wenn die Liste alle 30 s neu lädt
	const mailId = $derived(data.mail.id);
	$effect(() => {
		void mailId;
		untrack(() => {
			customerId = data.mail.customerId ? String(data.mail.customerId) : '';
			// Standard ist das Original (HTML) – Text nur, wenn es keins gibt
			mode = data.mail.html ? 'html' : 'text';
			replyOpen = false;
			editAssign = false;
		});
	});

	/** HTML-Mails in einer Sandbox: keine Skripte, keine nachgeladenen Bilder (Tracking) */
	const srcdoc = $derived(
		m.html
			? `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'; font-src data:"><base target="_blank"><style>body{margin:16px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#141a33;background:#fff}img{max-width:100%;height:auto}</style></head><body>${m.html}</body></html>`
			: ''
	);

	const quote = $derived(
		`\n\n\nAm ${dateTime(m.date)} schrieb ${m.fromName || m.fromAddr}:\n${(m.text ?? '')
			.split('\n')
			.map((l) => `> ${l}`)
			.join('\n')}`
	);
	const subjectRe = $derived(/^(re|aw):/i.test(m.subject) ? m.subject : `Re: ${m.subject}`);
	const sender = $derived(m.fromName || m.fromAddr);
	const deleteDetail = $derived(
		data.recoverable
			? 'Sie landet in deinem Postfach im Papierkorb („Gelöschte Elemente“) und lässt sich dort wiederherstellen.'
			: m.direction === 'aus'
				? 'Nur im Portal – die Kopie in deinem Postfach bleibt.'
				: 'Sie ist danach endgültig weg.'
	);
</script>

<svelte:head><title>{m.subject} – Posteingang</title></svelte:head>

<article class="reader">
	<a class="back" href="/posteingang?ansicht={data.view}"><ArrowLeft size={16} /> Zurück</a>

	<div class="toolbar">
		{#if m.direction === 'ein'}
			<button class="btn sm" type="button" onclick={() => ((forward = false), (replyOpen = true))}><Reply size={15} /> Antworten</button>
		{/if}
		<button class="btn ghost sm" type="button" title="Weiterleiten" onclick={() => ((forward = true), (replyOpen = true))}><Forward size={15} /> <span class="lbl-narrow">Weiterleiten</span></button>
		<span class="gap"></span>
		{#if m.direction === 'ein'}
			<form method="POST" action="?/ungelesen" use:enhance={submit()}>
				<input type="hidden" name="ansicht" value={data.view} />
				<button class="btn quiet sm" type="submit" title="Als ungelesen markieren"><Mail size={15} /> <span class="lbl">Ungelesen</span></button>
			</form>
		{/if}
		<form method="POST" action="?/ausblenden" use:enhance={submit()}>
			<button class="btn quiet sm" type="submit" title={m.ignored ? 'Wieder im Posteingang zeigen' : 'Aus dem Posteingang ausblenden'}><EyeOff size={15} /> <span class="lbl">{m.ignored ? 'Einblenden' : 'Ausblenden'}</span></button>
		</form>
		<form method="POST" action="?/loeschen" use:enhance={submit({ confirm: 'Mail löschen?', confirmDetail: deleteDetail })}>
			<input type="hidden" name="ansicht" value={data.view} />
			<button class="btn quiet sm del" type="submit" title="Löschen"><Trash2 size={15} /> <span class="lbl">Löschen</span></button>
		</form>
	</div>

	<h1>{m.subject}</h1>

	<div class="sender">
		<span class="avatar" style="--c: {avatarColor(m.fromAddr)}" aria-hidden="true">{initials(sender) || '?'}</span>
		<div class="who">
			<p><strong>{sender}</strong>{#if m.fromName}<span class="addr">&lt;{m.fromAddr}&gt;</span>{/if}</p>
			<p class="small muted">An: {m.toAddrs}{#if m.ccAddrs} · CC: {m.ccAddrs}{/if}</p>
		</div>
		<time class="small muted" datetime={m.date} title={dateTime(m.date)}>{listTime(m.date)}</time>
	</div>

	{#if m.status === 'fehler'}<p class="notice danger">Nicht gesendet: {m.error}</p>{/if}

	<!-- Zuordnung zu Kunde und Projekt – kompakt über dem Text -->
	<div class="assign">
		<Link2 size={15} />
		{#if data.customer && !editAssign}
			<span>Bei <a href="/kunden/{data.customer.id}">{data.customer.name}</a>{#if m.projectId}{@const p = data.projects.find((x) => x.id === m.projectId)}{#if p} · <a href="/projekte/{p.id}">{p.title}</a>{/if}{/if}</span>
			<button class="link" type="button" onclick={() => (editAssign = true)}>Ändern</button>
		{:else}
			<form method="POST" action="?/zuordnen" class="assign-form" use:enhance={submit({ done: () => (editAssign = false) })}>
				<select name="customerId" bind:value={customerId} aria-label="Kunde">
					<option value="">– kein Kunde –</option>
					{#each data.customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
				</select>
				{#if data.projects.length && customerId === String(m.customerId)}
					<select name="projectId" value={m.projectId ? String(m.projectId) : ''} aria-label="Projekt">
						<option value="">– kein Projekt –</option>
						{#each data.projects as p (p.id)}<option value={String(p.id)}>{p.title}</option>{/each}
					</select>
				{/if}
				<button class="btn ghost sm" type="submit">Zuordnen</button>
			</form>
			{#if !m.customerId && m.direction === 'ein'}
				<form method="POST" action="?/als_kunde" use:enhance={submit()}>
					<button class="btn quiet sm" type="submit"><UserPlus size={15} /> Als neuen Kunden anlegen</button>
				</form>
				{#if customerId}
					<form method="POST" action="?/als_kontakt" use:enhance={submit()}>
						<input type="hidden" name="customerId" value={customerId} />
						<button class="btn quiet sm" type="submit"><UserPlus size={15} /> Als Ansprechperson merken</button>
					</form>
				{/if}
			{/if}
		{/if}
	</div>

	{#if data.files.length}
		<div class="atts">
			{#each data.files as f (f.id)}
				<a class="att" href="/dateien/{f.id}" target="_blank" rel="noopener"><Paperclip size={14} /> <span>{f.name}</span> <small>{bytes(f.size)}</small></a>
			{/each}
		</div>
	{/if}

	{#if m.html && m.text}
		<div class="view">
			<button type="button" class:on={mode === 'html'} onclick={() => (mode = 'html')}>Original</button>
			<button type="button" class:on={mode === 'text'} onclick={() => (mode = 'text')}>Text</button>
		</div>
	{/if}

	{#if mode === 'html' && srcdoc}
		<iframe class="html" title="Inhalt der Mail" sandbox="allow-popups allow-popups-to-escape-sandbox" {srcdoc}></iframe>
		<p class="small faint">Bilder aus dem Internet werden zum Schutz vor Tracking nicht geladen.</p>
	{:else}
		<div class="text prewrap">{m.text || '(kein Text)'}</div>
	{/if}

	{#if data.thread.length}
		<section class="thread">
			<h2><MessagesSquare size={15} /> Im Gespräch</h2>
			<ul>
				{#each data.thread as t (t.id)}
					<li><a href="/posteingang/{t.id}?ansicht={data.view}">{t.direction === 'aus' ? '↗' : '↘'} {t.subject}</a> <span class="faint">{dateTime(t.date)}</span></li>
				{/each}
			</ul>
		</section>
	{/if}
</article>

<Compose
	bind:open={replyOpen}
	to={forward ? '' : m.direction === 'ein' ? m.fromAddr : m.toAddrs}
	subject={forward ? `Fwd: ${m.subject}` : subjectRe}
	text={forward ? `\n\n---------- Weitergeleitete Nachricht ----------\nVon: ${m.fromName ?? ''} <${m.fromAddr}>\nDatum: ${dateTime(m.date)}\nBetreff: ${m.subject}\n\n${m.text ?? ''}` : `Guten Tag${m.fromName ? ` ${m.fromName}` : ''},${quote}`}
	customerId={m.customerId}
	projectId={m.projectId}
	inReplyTo={forward ? null : m.messageId}
	references={forward ? null : [m.references, m.messageId].filter(Boolean).join(' ')}
/>

<style>
	.reader {
		display: grid;
		align-content: start;
		gap: 1rem;
		max-width: 62rem;
		padding: 1rem 1.75rem 2.5rem;
		animation: page-in 0.35s var(--ease-out) backwards;
	}

	.back {
		display: none;
		align-items: center;
		gap: 0.35rem;
		color: var(--dust);
		font-size: 0.88rem;
		text-decoration: none;
	}

	.toolbar {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin: -1rem -1.75rem 0;
		padding: 0.7rem 1.75rem;
		border-bottom: 1px solid var(--line-soft);
		background: rgb(11 19 48 / 0.9);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.gap {
		flex: 1;
	}

	.del:hover {
		color: var(--danger);
	}

	h1 {
		margin-top: 0.4rem;
		font-family: var(--font-body);
		font-size: 1.35rem;
		font-stretch: 100%;
		font-weight: 650;
		letter-spacing: 0;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.sender {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--c) 20%, transparent);
		color: var(--c);
		font-weight: 700;
	}

	.who {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.who p {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.addr {
		margin-left: 0.4rem;
		color: var(--dust);
		font-size: 0.85rem;
	}

	.sender time {
		align-self: start;
		white-space: nowrap;
	}

	/* Zuordnung als schmale Leiste */
	.assign {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		padding: 0.55rem 0.85rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
		background: rgb(7 13 36 / 0.4);
		color: var(--dust);
		font-size: 0.88rem;
	}

	.assign a {
		color: var(--accent);
	}

	.assign-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.assign select {
		min-height: 2rem;
		max-width: 15rem;
		padding: 0.2rem 0.6rem;
		font-size: 0.85rem;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--dust-2);
		font-size: 0.82rem;
		text-decoration: underline;
		cursor: pointer;
	}

	.link:hover {
		color: var(--star);
	}

	.atts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.att {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		max-width: 18rem;
		padding: 0.45rem 0.75rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: rgb(7 13 36 / 0.45);
		color: var(--star);
		font-size: 0.84rem;
		text-decoration: none;
	}

	.att span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.att small {
		flex: none;
		color: var(--dust-2);
	}

	.att:hover {
		border-color: var(--accent);
	}

	.view {
		display: inline-flex;
		justify-self: start;
		padding: 0.15rem;
		border: 1px solid var(--line);
		border-radius: 999px;
	}

	.view button {
		padding: 0.2rem 0.75rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--dust);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.view button.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	.text {
		padding: 0.25rem 0;
		font-size: 0.95rem;
		line-height: 1.65;
		overflow-wrap: anywhere;
	}

	.html {
		width: 100%;
		height: max(26rem, calc(100svh - var(--topbar) - 18rem));
		border: 0;
		border-radius: 12px;
		background: #fff;
	}

	.thread {
		display: grid;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--line-soft);
	}

	.thread h2 {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-body);
		font-size: 0.9rem;
		font-stretch: 100%;
	}

	.thread ul {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.86rem;
	}

	.thread a {
		color: var(--accent);
	}

	/* Schmaler Lesebereich: nur Symbole in der Werkzeugleiste */
	@container (max-width: 680px) {
		.lbl {
			display: none;
		}
	}

	@container (max-width: 430px) {
		.lbl-narrow {
			display: none;
		}
	}

	@media (max-width: 960px) {
		.reader {
			padding: 0.75rem var(--gutter) 2rem;
		}
		.back {
			display: inline-flex;
		}
		.toolbar {
			position: static;
			margin: 0;
			padding: 0;
			border: 0;
			background: none;
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
</style>
