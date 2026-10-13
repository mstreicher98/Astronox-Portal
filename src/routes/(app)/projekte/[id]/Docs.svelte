<script lang="ts">
	import { enhance } from '$app/forms';
	import { FileText, ReceiptText } from '@lucide/svelte';
	import type { DocumentRow } from '$lib/server/db/schema';
	import { date, money } from '$lib/shared/format';
	import { DOC_STATUS } from '$lib/shared/stages';
	import { submit } from '$lib/ui/form';

	let { documents }: { documents: DocumentRow[] } = $props();
	const total = (type: string, statuses: string[]) => documents.filter((d) => d.type === type && statuses.includes(d.status)).reduce((s, d) => s + d.grossCents, 0);
</script>

<div class="stack">
	<div class="grid-3">
		<div class="card"><p class="small muted">Angeboten</p><p class="v num">{money(total('angebot', ['offen', 'angenommen']))}</p></div>
		<div class="card"><p class="small muted">Verrechnet</p><p class="v num">{money(total('rechnung', ['offen', 'bezahlt']))}</p></div>
		<div class="card"><p class="small muted">Davon offen</p><p class="v num">{money(total('rechnung', ['offen']))}</p></div>
	</div>

	<div class="card flush">
		<div class="card-head">
			<h2>Angebote & Rechnungen</h2>
			<div class="row">
				<form method="POST" action="?/beleg" use:enhance={submit()}><input type="hidden" name="type" value="angebot" /><button class="btn ghost sm" type="submit"><FileText size={14} /> Angebot</button></form>
				<form method="POST" action="?/beleg" use:enhance={submit()}><input type="hidden" name="type" value="rechnung" /><button class="btn ghost sm" type="submit"><ReceiptText size={14} /> Rechnung</button></form>
			</div>
		</div>
		{#if documents.length}
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Nummer</th><th>Art</th><th>Titel</th><th>Datum</th><th class="right">Betrag</th><th>Status</th></tr></thead>
					<tbody>
						{#each documents as d (d.id)}
							<tr>
								<td><a class="rowlink mono" href="/rechnungen/{d.id}">{d.number ?? 'Entwurf'}</a></td>
								<td class="muted">{d.type === 'angebot' ? 'Angebot' : d.cancelsId ? 'Storno' : 'Rechnung'}</td>
								<td>{d.title}</td>
								<td class="small">{date(d.issueDate)}</td>
								<td class="right num">{money(d.grossCents)}</td>
								<td><span class="badge {DOC_STATUS[d.status].tone}">{DOC_STATUS[d.status].label}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="empty-p">Noch keine Belege zu diesem Projekt.</p>
		{/if}
	</div>
</div>

<style>
	.v {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.35rem;
	}

	.empty-p {
		padding: 1rem 1.25rem 1.4rem;
		color: var(--dust);
	}
</style>
