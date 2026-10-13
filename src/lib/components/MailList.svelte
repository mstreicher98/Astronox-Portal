<script lang="ts">
	import { CircleAlert, CornerUpLeft, Inbox, Paperclip, Send } from '@lucide/svelte';
	import { relative } from '$lib/shared/format';

	/** Kurze Liste von E-Mails (Kunde, Projekt) – Klick öffnet die Mail im Posteingang */
	type M = { id: number; direction: string; subject: string; fromAddr: string; fromName: string | null; toAddrs: string; date: string; seen: boolean; status: string; attachments: string };
	let { mails }: { mails: M[] } = $props();
</script>

{#if mails.length}
	<ul class="list mails">
		{#each mails as m (m.id)}
			{@const att = JSON.parse(m.attachments || '[]').length}
			<li>
				<a href="/posteingang/{m.id}" class:unread={m.direction === 'ein' && !m.seen}>
					<span class="dir {m.direction}">
						{#if m.status === 'fehler'}<CircleAlert size={15} />{:else if m.direction === 'ein'}<Inbox size={15} />{:else}<Send size={15} />{/if}
					</span>
					<span class="txt">
						<strong>{m.subject}</strong>
						<small>{m.direction === 'ein' ? `von ${m.fromName || m.fromAddr}` : `an ${m.toAddrs}`}{m.status === 'fehler' ? ' · nicht gesendet' : ''}</small>
					</span>
					{#if att}<span class="faint" title="{att} Anhang"><Paperclip size={13} /></span>{/if}
					<time>{relative(m.date)}</time>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="small muted row"><CornerUpLeft size={15} /> Noch keine E-Mails.</p>
{/if}

<style>
	.mails a {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.2rem;
		text-decoration: none;
		border-radius: 10px;
	}

	.mails a:hover {
		background: rgb(143 155 255 / 0.05);
	}

	.dir {
		display: grid;
		place-items: center;
		flex: none;
		width: 1.9rem;
		height: 1.9rem;
		border-radius: 50%;
		background: var(--nebula-soft);
		color: var(--nebula);
	}

	.dir.aus {
		background: rgb(177 151 252 / 0.12);
		color: var(--violet);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: grid;
		line-height: 1.3;
	}

	.txt strong {
		font-size: 0.88rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unread .txt strong {
		font-weight: 700;
	}

	.txt small {
		color: var(--dust-2);
		font-size: 0.77rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	time {
		color: var(--dust-2);
		font-size: 0.75rem;
		white-space: nowrap;
	}
</style>
