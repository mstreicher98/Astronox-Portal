<script lang="ts">
	import { enhance } from '$app/forms';
	import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from '@lucide/svelte';
	import { addMonths, date, duration, hours, money, monthLabel, today } from '$lib/shared/format';
	import { countUp, glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	const prev = $derived(addMonths(`${data.month}-01`, -1).slice(0, 7));
	const next = $derived(addMonths(`${data.month}-01`, 1).slice(0, 7));
	const done = $derived(data.entries.filter((e) => e.endedAt));
	const total = $derived(done.reduce((s, e) => s + e.minutes, 0));
	const billable = $derived(done.filter((e) => e.billable).reduce((s, e) => s + e.minutes, 0));
	const value = $derived(done.filter((e) => e.billable).reduce((s, e) => s + Math.round((e.minutes / 60) * e.rate), 0));

	const byProject = $derived.by(() => {
		const m = new Map<number, { title: string; customer: string; minutes: number }>();
		for (const e of done) {
			const cur = m.get(e.projectId) ?? { title: e.project, customer: e.customer, minutes: 0 };
			cur.minutes += e.minutes;
			m.set(e.projectId, cur);
		}
		return [...m.entries()].sort((a, b) => b[1].minutes - a[1].minutes);
	});
	const maxMin = $derived(Math.max(1, ...byProject.map(([, p]) => p.minutes)));
	const palette = ['var(--accent)', 'var(--sky)', 'var(--nebula)', 'var(--violet)', 'var(--pink)', 'var(--peach)'];
</script>

<svelte:head><title>Zeiten – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Zeiten</h1>
			<div class="month">
				<a class="btn quiet icon sm" href="?monat={prev}" aria-label="Vormonat"><ChevronLeft size={16} /></a>
				<strong>{monthLabel(data.month)}</strong>
				<a class="btn quiet icon sm" href="?monat={next}" aria-label="Nächster Monat"><ChevronRight size={16} /></a>
				{#if data.month !== today().slice(0, 7)}<a class="small" href="?">heute</a>{/if}
			</div>
		</div>
	</div>

	<div class="grid-3 stagger">
		<div class="card" use:glow style="--i: 0"><p class="small muted">Erfasst</p><p class="v num" use:countUp={{ value: total / 60, format: (n) => `${hours(n * 60)} h` }}>0 h</p></div>
		<div class="card" use:glow style="--i: 1"><p class="small muted">Verrechenbar</p><p class="v num" use:countUp={{ value: billable / 60, format: (n) => `${hours(n * 60)} h` }}>0 h</p></div>
		<div class="card" use:glow style="--i: 2"><p class="small muted">Wert</p><p class="v num" use:countUp={{ value, format: (n) => money(Math.round(n)) }}>€ 0</p></div>
	</div>

	<div class="split">
		<div class="card flush" use:glow>
			<div class="card-head"><h2><Clock size={16} /> Einträge</h2></div>
			{#if data.entries.length}
				<div class="table-wrap">
					<table class="table">
						<thead><tr><th>Tag</th><th>Projekt</th><th>Tätigkeit</th><th class="right">Dauer</th><th></th></tr></thead>
						<tbody>
							{#each data.entries as e (e.id)}
								<tr>
									<td class="small">{date(e.startedAt)}</td>
									<td><a class="rowlink" href="/projekte/{e.projectId}?tab=zeit">{e.project}</a><br /><small class="muted">{e.customer}</small></td>
									<td>{e.description ?? '–'} {#if !e.billable}<span class="badge muted">intern</span>{/if}{#if e.invoice}<span class="badge ok">{e.invoice}</span>{/if}</td>
									<td class="right num">{e.endedAt ? duration(e.minutes) : 'läuft'}</td>
									<td class="right">
										{#if !e.invoiceId && e.endedAt}
											<form method="POST" action="?/loeschen" use:enhance={submit({ confirm: 'Eintrag löschen?' })}>
												<input type="hidden" name="id" value={e.id} />
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
				<p class="pad muted">Keine Zeiten in diesem Monat.</p>
			{/if}
		</div>

		<div class="stack">
			<form method="POST" action="?/neu" class="card stack" use:glow use:enhance={submit({ reset: true })}>
				<h2><Plus size={16} /> Zeit nachtragen</h2>
				<label class="field">
					<span>Projekt</span>
					<select name="projectId" required>
						<option value="">Bitte wählen …</option>
						{#each data.projects as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
					</select>
				</label>
				<div class="form-grid">
					<label class="field"><span>Tag</span><input name="day" type="date" value={today()} /></label>
					<label class="field"><span>Dauer</span><input name="duration" required placeholder="1:30" /></label>
				</div>
				<label class="field"><span>Tätigkeit</span><input name="description" /></label>
				<label class="check"><input type="checkbox" name="billable" checked /> verrechenbar</label>
				<div class="form-actions"><button class="btn ghost sm" type="submit">Erfassen</button></div>
			</form>

			{#if byProject.length}
				<div class="card" use:glow>
					<h2>Nach Projekt</h2>
					<ul class="bars">
						{#each byProject as [id, p], i (id)}
							<li style="--w: {(p.minutes / maxMin) * 100}%; --c: {palette[i % palette.length]}; --i: {i}">
								<span class="name"><a href="/projekte/{id}">{p.title}</a></span>
								<span class="track"><i></i></span>
								<span class="num small">{duration(p.minutes)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.month {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.4rem;
	}

	.month strong {
		min-width: 9rem;
		text-align: center;
	}

	.month a.small {
		color: var(--accent);
	}

	.v {
		margin-top: 0.3rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: 1.5rem;
	}

	.pad {
		padding: 0.5rem 1.25rem 1.25rem;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 0.3rem;
	}

	.bars {
		display: grid;
		gap: 0.6rem;
		margin: 0.6rem 0 0;
		padding: 0;
		list-style: none;
	}

	.bars li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5rem;
		gap: 0.3rem 0.6rem;
		align-items: center;
	}

	.name {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name a {
		text-decoration: none;
	}

	.track {
		height: 0.5rem;
		border-radius: 999px;
		background: rgb(39 50 95 / 0.5);
		overflow: hidden;
	}

	.track i {
		display: block;
		width: var(--w);
		height: 100%;
		border-radius: 999px;
		background: var(--c);
		transform-origin: left;
		animation: grow 0.9s var(--ease-out) both;
		animation-delay: calc(var(--i) * 60ms);
	}

	.bars .num {
		text-align: right;
	}
</style>
