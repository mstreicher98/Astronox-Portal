<script lang="ts">
	import { enhance } from '$app/forms';
	import { Clock, Plus, ReceiptText, Trash2 } from '@lucide/svelte';
	import type { TimeEntry } from '$lib/server/db/schema';
	import { date, duration, money, time, today } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { times, defaultRate }: { times: (TimeEntry & { invoice: string | null })[]; defaultRate: number } = $props();

	const finished = $derived(times.filter((t) => t.endedAt));
	const total = $derived(finished.reduce((s, t) => s + t.minutes, 0));
	const billable = $derived(finished.filter((t) => t.billable));
	const open = $derived(billable.filter((t) => !t.invoiceId));
	const openMinutes = $derived(open.reduce((s, t) => s + t.minutes, 0));
	const openValue = $derived(open.reduce((s, t) => s + Math.round((t.minutes / 60) * (t.rateCents ?? defaultRate)), 0));
</script>

<div class="split">
	<div class="card flush" use:glow>
		<div class="card-head"><h2><Clock size={16} /> Erfasste Zeiten</h2><span class="small muted">{duration(total)} gesamt</span></div>
		{#if times.length}
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Tag</th><th>Tätigkeit</th><th class="right">Dauer</th><th>Status</th><th></th></tr></thead>
					<tbody>
						{#each times as t (t.id)}
							<tr>
								<td class="small">{date(t.startedAt)}{#if !t.endedAt}<br /><span class="badge accent dot">läuft seit {time(t.startedAt)}</span>{/if}</td>
								<td>{t.description ?? '–'}</td>
								<td class="right num">{t.endedAt ? duration(t.minutes) : '…'}</td>
								<td>
									{#if t.invoice}<span class="badge ok">{t.invoice}</span>{:else if t.invoiceId}<span class="badge info">im Entwurf</span>{:else if !t.billable}<span class="badge muted">intern</span>{:else}<span class="badge warn">offen</span>{/if}
								</td>
								<td class="right">
									{#if !t.invoiceId}
										<form method="POST" action="?/zeit_loeschen" use:enhance={submit({ confirm: 'Eintrag löschen?' })}>
											<input type="hidden" name="id" value={t.id} />
											<button class="btn quiet icon sm" type="submit" aria-label="Löschen"><Trash2 size={14} /></button>
										</form>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="empty">Noch keine Zeiten – Timer oben starten oder rechts nachtragen.</p>
		{/if}
	</div>

	<div class="stack">
		<div class="card stack" use:glow>
			<div class="card-head"><h2><ReceiptText size={16} /> Abrechnen</h2></div>
			<p class="value num">{money(openValue)}</p>
			<p class="small muted">{duration(openMinutes)} verrechenbar und noch nicht abgerechnet ({open.length} Einträge)</p>
			<form method="POST" action="?/abrechnen" use:enhance={submit()}>
				<button class="btn" type="submit" disabled={!open.length}><ReceiptText size={15} /> Rechnungsentwurf erstellen</button>
			</form>
		</div>

		<form method="POST" action="?/zeit" class="card stack" use:glow use:enhance={submit({ reset: true })}>
			<div class="card-head"><h2><Plus size={16} /> Zeit nachtragen</h2></div>
			<div class="form-grid">
				<label class="field"><span>Tag</span><input name="day" type="date" value={today()} /></label>
				<label class="field"><span>Dauer</span><input name="duration" required placeholder="1:30 oder 1,5" /></label>
				<label class="field full"><span>Tätigkeit</span><input name="description" placeholder="z. B. Abstimmung Texte" /></label>
			</div>
			<label class="check"><input type="checkbox" name="billable" checked /> verrechenbar</label>
			<div class="form-actions"><button class="btn ghost sm" type="submit">Erfassen</button></div>
		</form>
	</div>
</div>

<style>
	.value {
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.7rem;
	}

	.empty {
		padding: 1.5rem 1.25rem;
	}
</style>
