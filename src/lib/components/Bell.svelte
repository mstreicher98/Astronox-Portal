<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { Bell, CalendarDays, CheckCheck, FileText, Mail, MessageSquarePlus, ServerCrash, Trash2, TriangleAlert, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import type { Notification } from '$lib/server/db/schema';
	import { relative } from '$lib/shared/format';
	import { outside } from '$lib/ui/actions';
import { ask } from '$lib/ui/confirm.svelte';

	let { notifications }: { notifications: { unread: number; recent: Notification[] } } = $props();
	let open = $state(false);
	let shake = $state(false);
	let lastUnread = 0;

	// Kurzes Wackeln, wenn etwas Neues kommt
	$effect(() => {
		if (notifications.unread > lastUnread && lastUnread !== 0) {
			shake = true;
			setTimeout(() => (shake = false), 900);
		}
		lastUnread = notifications.unread;
	});

	const icons: Record<string, typeof Bell> = { anfrage: MessageSquarePlus, termin: CalendarDays, mail: Mail, rechnung: FileText, angebot: FileText, monitor: ServerCrash, frist: TriangleAlert };

	async function readAll() {
		await fetch('/api/benachrichtigungen', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
		await invalidate('app:shell');
	}

	/** Eine löschen – ohne Angabe alle (mit Rückfrage) */
	async function remove(n?: Notification) {
		if (!n && !(await ask('Alle Benachrichtigungen löschen?', { confirm: 'Löschen', danger: true }))) return;
		await fetch('/api/benachrichtigungen', { method: 'DELETE', body: JSON.stringify(n ? { id: n.id } : {}), headers: { 'content-type': 'application/json' } });
		await invalidate('app:shell');
	}

	async function openOne(n: Notification) {
		open = false;
		if (!n.readAt) await fetch('/api/benachrichtigungen', { method: 'POST', body: JSON.stringify({ id: n.id }), headers: { 'content-type': 'application/json' } });
		if (n.url) await goto(n.url);
		await invalidate('app:shell');
	}
</script>

<div class="bell" use:outside={() => (open = false)}>
	<button class="btn quiet icon trigger" class:shake type="button" aria-label="Benachrichtigungen" aria-expanded={open} onclick={() => (open = !open)}>
		<Bell size={19} />
		{#if notifications.unread}<b>{notifications.unread > 9 ? '9+' : notifications.unread}</b>{/if}
	</button>
	{#if open}
		<div class="panel" transition:fly={{ y: -8, duration: 220 }}>
			<div class="spread head">
				<strong>Benachrichtigungen</strong>
				<div class="row">
					{#if notifications.unread}<button class="btn quiet sm" type="button" onclick={readAll}><CheckCheck size={15} /> Alle gelesen</button>{/if}
					{#if notifications.recent.length}<button class="btn quiet sm icon" type="button" title="Alle löschen" aria-label="Alle löschen" onclick={() => remove()}><Trash2 size={15} /></button>{/if}
				</div>
			</div>
			{#if notifications.recent.length}
				<ul class="list">
					{#each notifications.recent as n, i (n.id)}
						{@const Icon = icons[n.kind] ?? Bell}
						<li style="--i: {i}">
							<button type="button" class:unread={!n.readAt} onclick={() => openOne(n)}>
								<span class="ico {n.kind}"><Icon size={16} /></span>
								<span class="txt">
									<strong>{n.title}</strong>
									{#if n.body}<small>{n.body}</small>{/if}
								</span>
								<time>{relative(n.createdAt)}</time>
							</button>
							<button class="del" type="button" title="Löschen" aria-label="Benachrichtigung löschen" onclick={() => remove(n)}><X size={15} /></button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty small">Noch keine Benachrichtigungen.</p>
			{/if}
			<a class="all small" href="/einstellungen/benachrichtigungen" onclick={() => (open = false)}>Push aufs Handy einrichten</a>
		</div>
	{/if}
</div>

<style>
	.bell {
		position: relative;
	}

	.trigger {
		position: relative;
	}

	.trigger b {
		position: absolute;
		top: 0.1rem;
		right: 0.05rem;
		min-width: 1.05rem;
		height: 1.05rem;
		padding: 0 0.25rem;
		border-radius: 999px;
		background: var(--pink);
		color: var(--night);
		font-size: 0.65rem;
		line-height: 1.05rem;
		box-shadow: 0 0 10px rgb(var(--pink-rgb) / 0.8);
	}

	.shake :global(svg) {
		animation: ring 0.9s var(--ease-out);
		transform-origin: 50% 10%;
	}

	.panel {
		position: absolute;
		right: 0;
		top: calc(100% + 0.5rem);
		z-index: 70;
		width: min(23rem, calc(100vw - 1.5rem));
		max-height: 70vh;
		overflow-y: auto;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: var(--glass-strong);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow: 0 30px 70px -20px rgb(0 0 0 / 0.8);
	}

	.head {
		padding: 0.75rem 0.75rem 0.5rem 1rem;
	}

	li {
		position: relative;
		animation: rise 0.4s var(--ease-out) both;
		animation-delay: calc(var(--i) * 30ms);
	}

	/* Löschen erscheint beim Darüberfahren an der Stelle der Zeit */
	.del {
		position: absolute;
		top: 0.55rem;
		right: 0.6rem;
		display: grid;
		place-items: center;
		width: 1.7rem;
		height: 1.7rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--dust);
		opacity: 0;
		cursor: pointer;
		transition:
			opacity 0.15s,
			color 0.15s,
			background-color 0.15s;
	}

	li:hover .del,
	.del:focus-visible {
		opacity: 1;
	}

	li:hover time {
		opacity: 0;
	}

	.del:hover {
		background: rgb(var(--danger-rgb) / 0.12);
		color: var(--danger);
	}

	/* Ohne Maus: Löschen immer sichtbar, die Zeit rückt davor */
	@media (hover: none) {
		.del {
			opacity: 1;
		}
		li > button:first-child {
			padding-right: 2.6rem;
		}
		li:hover time {
			opacity: 1;
		}
	}

	li > button:first-child {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: start;
		gap: 0.65rem;
		width: 100%;
		padding: 0.7rem 1rem;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	li button:hover {
		background: rgb(143 155 255 / 0.07);
	}

	.unread {
		background: linear-gradient(90deg, rgb(var(--accent-rgb) / 0.07), transparent 70%);
	}

	.unread .txt strong::after {
		content: '';
		display: inline-block;
		width: 0.4rem;
		height: 0.4rem;
		margin-left: 0.4rem;
		border-radius: 50%;
		background: var(--accent);
		vertical-align: middle;
	}

	.ico {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 9px;
		background: var(--nebula-soft);
		color: var(--nebula);
	}

	.ico.anfrage {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.ico.monitor,
	.ico.frist {
		background: rgb(var(--danger-rgb) / 0.12);
		color: var(--danger);
	}
	.ico.rechnung {
		background: rgb(var(--warn-rgb) / 0.12);
		color: var(--warn);
	}

	.txt {
		display: grid;
		line-height: 1.35;
	}

	.txt strong {
		font-size: 0.86rem;
		font-weight: 600;
	}

	.txt small {
		color: var(--dust);
		font-size: 0.78rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	time {
		color: var(--dust-2);
		font-size: 0.72rem;
		white-space: nowrap;
	}

	.empty {
		padding: 1.5rem 1rem;
		color: var(--dust);
		text-align: center;
	}

	.all {
		display: block;
		padding: 0.7rem 1rem;
		border-top: 1px solid var(--line-soft);
		color: var(--dust);
		text-align: center;
		text-decoration: none;
	}

	.all:hover {
		color: var(--accent);
	}

	@keyframes ring {
		0%,
		100% {
			rotate: 0deg;
		}
		15% {
			rotate: 16deg;
		}
		30% {
			rotate: -14deg;
		}
		45% {
			rotate: 10deg;
		}
		60% {
			rotate: -6deg;
		}
		75% {
			rotate: 3deg;
		}
	}
</style>
