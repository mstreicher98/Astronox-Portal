<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { CircleCheck, Plus } from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { addDays, date, relative, today } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { api, submit } from '$lib/ui/form';

	let { data } = $props();
	const day = today();
	const week = addDays(day, 7);
	let showDone = $state(false);

	const groups = $derived.by(() => {
		const open = data.tasks.filter((t) => !t.doneAt);
		return [
			{ id: 'late', label: 'Überfällig', tone: 'danger', items: open.filter((t) => t.dueDate && t.dueDate < day) },
			{ id: 'today', label: 'Heute', tone: 'warn', items: open.filter((t) => t.dueDate === day) },
			{ id: 'week', label: 'Nächste 7 Tage', tone: 'info', items: open.filter((t) => t.dueDate && t.dueDate > day && t.dueDate <= week) },
			{ id: 'later', label: 'Später', tone: 'muted', items: open.filter((t) => t.dueDate && t.dueDate > week) },
			{ id: 'none', label: 'Ohne Datum', tone: 'muted', items: open.filter((t) => !t.dueDate) },
			...(showDone ? [{ id: 'done', label: 'Erledigt (7 Tage)', tone: 'ok', items: data.tasks.filter((t) => t.doneAt) }] : [])
		].filter((g) => g.items.length);
	});

	let pending = $state<Record<number, boolean>>({});
	async function toggle(id: number, done: boolean) {
		pending[id] = done;
		// kurz zeigen, dass es abgehakt ist, dann weg damit
		setTimeout(async () => {
			await api('/api/aufgaben', { id, done });
			await invalidateAll();
			delete pending[id];
		}, done ? 450 : 0);
	}
</script>

<svelte:head><title>Aufgaben – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Aufgaben</h1>
			<p class="lead">{data.tasks.filter((t) => !t.doneAt).length} offen über alle Projekte</p>
		</div>
		<label class="switch small"><input type="checkbox" bind:checked={showDone} /> Erledigte zeigen</label>
	</div>

	<form method="POST" action="?/neu" class="card add" use:glow use:enhance={submit({ reset: true })}>
		<Plus size={18} />
		<input class="title" name="title" required placeholder="Neue Aufgabe …" autocomplete="off" />
		<select class="input" name="projectId" required aria-label="Projekt">
			<option value="">Projekt …</option>
			{#each data.projects as p (p.id)}<option value={p.id}>{p.title}</option>{/each}
		</select>
		<input class="input due" name="dueDate" type="date" aria-label="Fällig" />
		<button class="btn sm" type="submit">Anlegen</button>
	</form>

	{#each groups as g (g.id)}
		<section class="card" use:glow>
			<h2><span class="badge {g.tone} dot">{g.label}</span> <span class="faint small">{g.items.length}</span></h2>
			<ul class="list">
				{#each g.items as t (t.id)}
					<li animate:flip={{ duration: 280 }} class:done={pending[t.id] ?? !!t.doneAt}>
						<label class="check">
							<input type="checkbox" checked={pending[t.id] ?? !!t.doneAt} onchange={(e) => toggle(t.id, (e.currentTarget as HTMLInputElement).checked)} />
							<span class="sr-only">erledigt</span>
						</label>
						<a href="/projekte/{t.projectId}?tab=aufgaben" class="txt">
							<strong>{t.title}</strong>
							<small>{t.project} · {t.customer}</small>
						</a>
						{#if t.dueDate}<time class:late={!t.doneAt && t.dueDate < day} title={date(t.dueDate)}>{relative(t.dueDate)}</time>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<div class="card empty"><CircleCheck size={32} /><p>Alles erledigt. Schön!</p></div>
	{/each}
</div>

<style>
	.add {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.8rem;
		color: var(--dust-2);
	}

	.add .title {
		flex: 1;
		min-width: 0;
		height: 2.3rem;
		border: 0;
		background: transparent;
		outline: none;
		font-size: 0.95rem;
	}

	.add select {
		width: 14rem;
		min-height: 2.2rem;
		padding: 0.3rem 2rem 0.3rem 0.6rem;
	}

	.add .due {
		width: 9.5rem;
		min-height: 2.2rem;
		padding: 0.3rem 0.5rem;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0;
		transition: opacity 0.4s;
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: grid;
		line-height: 1.35;
		text-decoration: none;
	}

	.txt strong {
		font-weight: 550;
		font-size: 0.92rem;
	}

	.txt small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.txt:hover strong {
		color: var(--accent);
	}

	.done {
		opacity: 0.45;
	}

	.done strong {
		text-decoration: line-through;
	}

	time {
		color: var(--dust);
		font-size: 0.8rem;
		white-space: nowrap;
	}

	time.late {
		color: var(--danger);
	}

	@media (max-width: 760px) {
		.add {
			flex-wrap: wrap;
		}
		.add select,
		.add .due {
			flex: 1;
			width: auto;
		}
	}
</style>
