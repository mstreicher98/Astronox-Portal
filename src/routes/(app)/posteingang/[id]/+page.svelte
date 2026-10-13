<script lang="ts">
	import { enhance } from '$app/forms';
	import { EyeOff, Forward, Link2, Mail, MailOpen, Paperclip, Reply, UserPlus } from '@lucide/svelte';
	import Compose from '$lib/components/Compose.svelte';
	import { bytes, dateTime } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const m = $derived(data.mail);
	let mode = $state<'text' | 'html'>('text');
	let replyOpen = $state(false);
	let forward = $state(false);
	let customerId = $state('');
	$effect(() => {
		customerId = data.mail.customerId ? String(data.mail.customerId) : '';
		mode = data.mail.html && !data.mail.text ? 'html' : 'text';
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
</script>

<svelte:head><title>{m.subject} – Posteingang</title></svelte:head>

<div class="page">
	<div class="crumbs"><a href="/posteingang">Posteingang</a> / Mail</div>
	<div class="layout">
		<article class="card stack mail" use:glow>
			<header class="stack-sm">
				<h1>{m.subject}</h1>
				<div class="meta small">
					<p><span class="faint">Von</span> <strong>{m.fromName ?? ''}</strong> &lt;{m.fromAddr}&gt;</p>
					<p><span class="faint">An</span> {m.toAddrs}</p>
					{#if m.ccAddrs}<p><span class="faint">CC</span> {m.ccAddrs}</p>{/if}
					<p><span class="faint">Am</span> {dateTime(m.date)}{#if m.status === 'fehler'} · <span class="badge danger">nicht gesendet: {m.error}</span>{/if}</p>
				</div>
				<div class="row wrap">
					{#if m.direction === 'ein'}
						<button class="btn sm" type="button" onclick={() => ((forward = false), (replyOpen = true))}><Reply size={15} /> Antworten</button>
					{/if}
					<button class="btn ghost sm" type="button" onclick={() => ((forward = true), (replyOpen = true))}><Forward size={15} /> Weiterleiten</button>
					{#if m.html && m.text}
						<div class="seg">
							<button type="button" class:on={mode === 'text'} onclick={() => (mode = 'text')}>Text</button>
							<button type="button" class:on={mode === 'html'} onclick={() => (mode = 'html')}>Original</button>
						</div>
					{/if}
					<form method="POST" action="?/ungelesen" use:enhance={submit()}><button class="btn quiet sm" type="submit"><MailOpen size={15} /> Ungelesen</button></form>
					<form method="POST" action="?/ausblenden" use:enhance={submit()}><button class="btn quiet sm" type="submit"><EyeOff size={15} /> {m.ignored ? 'Einblenden' : 'Ausblenden'}</button></form>
				</div>
			</header>

			{#if mode === 'html' && srcdoc}
				<iframe class="html" title="Inhalt der Mail" sandbox="allow-popups allow-popups-to-escape-sandbox" {srcdoc}></iframe>
				<p class="small faint">Bilder aus dem Internet werden zum Schutz vor Tracking nicht geladen.</p>
			{:else}
				<div class="text prewrap">{m.text || '(kein Text)'}</div>
			{/if}

			{#if data.files.length}
				<div class="row wrap atts">
					{#each data.files as f (f.id)}
						<a class="chip" href="/dateien/{f.id}" target="_blank" rel="noopener"><Paperclip size={13} /> {f.name} <span class="faint">{bytes(f.size)}</span></a>
					{/each}
				</div>
			{/if}
		</article>

		<aside class="stack">
			<div class="card stack" use:glow>
				<h2><Link2 size={16} /> Zuordnung</h2>
				{#if data.customer}
					<p>Bei <a href="/kunden/{data.customer.id}">{data.customer.name}</a></p>
				{:else}
					<p class="small muted">Diese Adresse ist noch keinem Kunden zugeordnet.</p>
				{/if}
				<form method="POST" action="?/zuordnen" class="stack" use:enhance={submit()}>
					<label class="field">
						<span>Kunde</span>
						<select name="customerId" bind:value={customerId}>
							<option value="">– keiner –</option>
							{#each data.customers as c (c.id)}<option value={String(c.id)}>{c.name}</option>{/each}
						</select>
					</label>
					{#if data.projects.length && customerId === String(m.customerId)}
						<label class="field">
							<span>Projekt</span>
							<select name="projectId" value={m.projectId ? String(m.projectId) : ''}>
								<option value="">– keines –</option>
								{#each data.projects as p (p.id)}<option value={String(p.id)}>{p.title}</option>{/each}
							</select>
						</label>
					{/if}
					<button class="btn ghost sm" type="submit">Speichern</button>
				</form>
				{#if !m.customerId && m.direction === 'ein'}
					<hr class="divider" />
					<form method="POST" action="?/als_kunde" use:enhance={submit()}>
						<button class="btn ghost sm wide" type="submit"><UserPlus size={15} /> Absender als neuen Kunden anlegen</button>
					</form>
					{#if customerId}
						<form method="POST" action="?/als_kontakt" use:enhance={submit()}>
							<input type="hidden" name="customerId" value={customerId} />
							<button class="btn quiet sm wide" type="submit"><UserPlus size={15} /> Als Ansprechperson merken</button>
						</form>
					{/if}
				{/if}
			</div>

			{#if data.thread.length}
				<div class="card stack" use:glow>
					<h2><Mail size={16} /> Im Gespräch</h2>
					<ul class="list small">
						{#each data.thread as t (t.id)}
							<li style="padding: 0.4rem 0"><a href="/posteingang/{t.id}">{t.direction === 'aus' ? '↗' : '↘'} {t.subject}</a> <span class="faint">{dateTime(t.date)}</span></li>
						{/each}
					</ul>
				</div>
			{/if}
		</aside>
	</div>
</div>

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
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20rem;
		gap: 1rem;
		align-items: start;
	}

	.mail h1 {
		font-size: 1.3rem;
		font-family: var(--font-body);
		font-stretch: 100%;
		font-weight: 650;
		letter-spacing: 0;
	}

	.meta {
		display: grid;
		gap: 0.15rem;
		color: var(--dust);
	}

	.meta .faint {
		display: inline-block;
		width: 2.4rem;
	}

	.text {
		padding: 1rem 1.1rem;
		border-radius: 12px;
		background: rgb(7 13 36 / 0.45);
		font-size: 0.93rem;
		line-height: 1.6;
	}

	.html {
		width: 100%;
		min-height: 60vh;
		border: 0;
		border-radius: 12px;
		background: #fff;
	}

	.seg {
		display: inline-flex;
		padding: 0.15rem;
		border: 1px solid var(--line);
		border-radius: 999px;
	}

	.seg button {
		padding: 0.2rem 0.7rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--dust);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.seg button.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	aside a {
		color: var(--accent);
	}

	.wide {
		width: 100%;
	}

	@media (max-width: 1000px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
