<script lang="ts">
	import {
		ArrowRightLeft,
		CalendarDays,
		CircleDollarSign,
		FileText,
		Mail,
		MailOpen,
		MessageSquarePlus,
		NotebookPen,
		Paperclip,
		Phone,
		ReceiptText,
		Sparkles
	} from '@lucide/svelte';
	import { dateTime, relative } from '$lib/shared/format';

	/** Verlauf bei Kunde, Projekt und im Cockpit */
	interface Item {
		id: number;
		kind: string;
		title: string;
		body: string | null;
		createdAt: string;
		customer?: string | null;
		project?: string | null;
		customerId?: number | null;
		projectId?: number | null;
		meta?: string | null;
	}

	let { items, context = false, compact = false }: { items: Item[]; context?: boolean; compact?: boolean } = $props();

	const icons: Record<string, typeof Mail> = {
		anfrage: MessageSquarePlus,
		termin: CalendarDays,
		mail_ein: Mail,
		mail_aus: MailOpen,
		phase: ArrowRightLeft,
		notiz: NotebookPen,
		anruf: Phone,
		angebot: FileText,
		rechnung: ReceiptText,
		zahlung: CircleDollarSign,
		datei: Paperclip
	};
	const colors: Record<string, string> = {
		anfrage: 'var(--accent)',
		termin: 'var(--sky)',
		mail_ein: 'var(--nebula)',
		mail_aus: 'var(--violet)',
		phase: 'var(--pink)',
		notiz: 'var(--peach)',
		anruf: 'var(--peach)',
		angebot: 'var(--violet)',
		rechnung: 'var(--warn)',
		zahlung: 'var(--ok)'
	};

	const mailId = (meta: string | null | undefined) => {
		try {
			return meta ? (JSON.parse(meta).mailId as number | undefined) : undefined;
		} catch {
			return undefined;
		}
	};
</script>

<ol class="timeline" class:compact>
	{#each items as it, i (it.id)}
		{@const Icon = icons[it.kind] ?? Sparkles}
		{@const mid = mailId(it.meta)}
		<li style="--i: {i}; --c: {colors[it.kind] ?? 'var(--dust-2)'}">
			<span class="dot"><Icon size={14} /></span>
			<div class="body">
				<p class="title">
					{#if mid}<a href="/posteingang/{mid}">{it.title}</a>{:else}{it.title}{/if}
				</p>
				{#if context && (it.customer || it.project)}
					<p class="ctx">
						{#if it.projectId && it.project}<a href="/projekte/{it.projectId}">{it.project}</a>{:else if it.customerId && it.customer}<a href="/kunden/{it.customerId}">{it.customer}</a>{/if}
					</p>
				{/if}
				{#if it.body && !compact}<p class="text prewrap">{it.body.length > 600 ? `${it.body.slice(0, 600)} …` : it.body}</p>{/if}
			</div>
			<time datetime={it.createdAt} title={dateTime(it.createdAt)}>{relative(it.createdAt)}</time>
		</li>
	{:else}
		<li class="none">Noch nichts passiert.</li>
	{/each}
</ol>

<style>
	.timeline {
		position: relative;
		display: grid;
		gap: 0.15rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		position: relative;
		display: grid;
		grid-template-columns: 1.9rem minmax(0, 1fr) auto;
		gap: 0.7rem;
		padding: 0.5rem 0;
		animation: rise 0.5s var(--ease-out) both;
		animation-delay: calc(min(var(--i), 12) * 40ms);
	}

	/* Bahn zwischen den Punkten */
	li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 0.94rem;
		top: 2.3rem;
		bottom: -0.3rem;
		width: 1px;
		background: linear-gradient(var(--line), transparent);
	}

	.dot {
		display: grid;
		place-items: center;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--c) 14%, transparent);
		color: var(--c);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 35%, transparent);
	}

	.title {
		font-size: 0.88rem;
		font-weight: 550;
		padding-top: 0.25rem;
	}

	.title a,
	.ctx a {
		text-decoration: none;
	}

	.title a:hover,
	.ctx a:hover {
		color: var(--accent);
	}

	.ctx {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.text {
		margin-top: 0.3rem;
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		background: rgb(7 13 36 / 0.45);
		color: var(--dust);
		font-size: 0.85rem;
	}

	time {
		padding-top: 0.3rem;
		color: var(--dust-2);
		font-size: 0.74rem;
		white-space: nowrap;
	}

	.none {
		display: block;
		color: var(--dust);
		font-size: 0.9rem;
	}

	.compact li {
		padding: 0.35rem 0;
	}
</style>
