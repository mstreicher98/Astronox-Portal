<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarClock, Flag, ListPlus, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import Modal from '$lib/components/Modal.svelte';
	import type { Milestone, Task } from '$lib/server/db/schema';
	import { date, relative, today } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { tasks, milestones, templates }: { tasks: Task[]; milestones: Milestone[]; templates: { id: number; name: string; items: string[] }[] } = $props();

	const done = $derived(tasks.filter((t) => t.doneAt).length);
	const pct = $derived(tasks.length ? done / tasks.length : 0);
	const groups = $derived([
		...milestones.map((m) => ({ m, items: tasks.filter((t) => t.milestoneId === m.id) })),
		{ m: null, items: tasks.filter((t) => !t.milestoneId) }
	]);

	let editing = $state<Task | null>(null);
	let editOpen = $state(false);
	let msOpen = $state(false);
	let msEdit = $state<Milestone | null>(null);
	let showDone = $state(true);
	const day = today();

	const toggle = (e: Event) => (e.currentTarget as HTMLInputElement).form?.requestSubmit();
</script>

<div class="split">
	<div class="stack">
		<form method="POST" action="?/aufgabe" class="card add" use:glow use:enhance={submit({ reset: true })}>
			<Plus size={18} />
			<input class="title" name="title" required placeholder="Neue Aufgabe … (Enter)" autocomplete="off" />
			<input class="input due" name="dueDate" type="date" aria-label="Fällig am" />
			{#if milestones.length}
				<select class="input ms" name="milestoneId" aria-label="Meilenstein">
					<option value="">Ohne Meilenstein</option>
					{#each milestones as m (m.id)}<option value={m.id}>{m.title}</option>{/each}
				</select>
			{/if}
		</form>

		{#each groups as g (g.m?.id ?? 'ohne')}
			{#if g.m || g.items.length}
				<section class="card group" use:glow class:reached={g.m?.doneAt}>
					<header class="spread">
						{#if g.m}
							<form method="POST" action="?/meilenstein_umschalten" use:enhance={submit()}>
								<input type="hidden" name="id" value={g.m.id} />
								<label class="check ms-check">
									<input type="checkbox" name="done" checked={!!g.m.doneAt} onchange={toggle} />
									<span class="ms-title"><Flag size={14} /> {g.m.title}</span>
								</label>
							</form>
							<div class="row">
								{#if g.m.dueDate}<span class="small" class:late={!g.m.doneAt && g.m.dueDate < day}>{date(g.m.dueDate)}</span>{/if}
								<span class="small faint">{g.items.filter((t) => t.doneAt).length}/{g.items.length}</span>
								<button
									class="btn quiet icon sm"
									type="button"
									aria-label="Meilenstein bearbeiten"
									onclick={() => {
										msEdit = g.m;
										msOpen = true;
									}}><Pencil size={13} /></button
								>
							</div>
						{:else}
							<span class="ms-title muted">Weitere Aufgaben</span>
						{/if}
					</header>
					<ul class="tasks">
						{#each g.items.filter((t) => showDone || !t.doneAt) as t (t.id)}
							<li animate:flip={{ duration: 250 }} in:fly={{ y: 8, duration: 300 }} class:done={!!t.doneAt}>
								<form method="POST" action="?/aufgabe_umschalten" use:enhance={submit()}>
									<input type="hidden" name="id" value={t.id} />
									<label class="check">
										<input type="checkbox" name="done" checked={!!t.doneAt} onchange={toggle} />
										<span class="sr-only">erledigt</span>
									</label>
								</form>
								<button
									type="button"
									class="task-title"
									onclick={() => {
										editing = t;
										editOpen = true;
									}}
								>
									{t.title}
									{#if t.notes}<small>{t.notes.slice(0, 90)}</small>{/if}
								</button>
								{#if t.dueDate}
									<span class="due-chip" class:late={!t.doneAt && t.dueDate < day} class:today={!t.doneAt && t.dueDate === day}><CalendarClock size={12} /> {relative(t.dueDate)}</span>
								{/if}
							</li>
						{:else}
							<li class="none small faint">Keine Aufgaben.</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/each}
	</div>

	<div class="stack">
		<div class="card progress-card" use:glow>
			<svg viewBox="0 0 120 120" class="ring" aria-hidden="true">
				<defs>
					<linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stop-color="#5eead4" />
						<stop offset="0.52" stop-color="#8f9bff" />
						<stop offset="1" stop-color="#f472b6" />
					</linearGradient>
				</defs>
				<circle cx="60" cy="60" r="50" class="bg" />
				<circle cx="60" cy="60" r="50" class="fg" stroke="url(#ring-grad)" style="stroke-dashoffset: {314 * (1 - pct)}" />
			</svg>
			<div>
				<p class="pct num">{Math.round(pct * 100)} %</p>
				<p class="small muted">{done} von {tasks.length} Aufgaben erledigt</p>
				<label class="switch small" style="margin-top: 0.6rem"><input type="checkbox" bind:checked={showDone} /> Erledigte zeigen</label>
			</div>
		</div>

		<div class="card stack" use:glow>
			<div class="card-head"><h2><Flag size={16} /> Meilenstein</h2></div>
			<form method="POST" action="?/meilenstein" class="stack" use:enhance={submit({ reset: true })}>
				<div class="form-grid">
					<label class="field"><span>Titel</span><input name="title" required placeholder="z. B. Erster Entwurf" /></label>
					<label class="field"><span>Bis</span><input name="dueDate" type="date" /></label>
				</div>
				<div class="form-actions"><button class="btn ghost sm" type="submit"><Plus size={14} /> Anlegen</button></div>
			</form>
		</div>

		{#if templates.length}
			<div class="card stack" use:glow>
				<div class="card-head"><h2><ListPlus size={16} /> Checkliste übernehmen</h2></div>
				<form method="POST" action="?/checkliste" class="stack" use:enhance={submit()}>
					<label class="field">
						<span>Vorlage</span>
						<select name="templateId">
							{#each templates as t (t.id)}<option value={t.id}>{t.name} ({t.items.length})</option>{/each}
						</select>
					</label>
					<label class="field"><span>Bis <small>(optional)</small></span><input name="dueDate" type="date" /></label>
					<div class="form-actions"><button class="btn ghost sm" type="submit">Übernehmen</button></div>
				</form>
				<p class="small faint">Vorlagen bearbeiten unter Einstellungen → Vorlagen.</p>
			</div>
		{/if}
	</div>
</div>

<Modal bind:open={editOpen} title="Aufgabe bearbeiten">
	{#if editing}
		<form method="POST" action="?/aufgabe" class="stack" use:enhance={submit({ done: () => (editOpen = false) })}>
			<input type="hidden" name="id" value={editing.id} />
			<label class="field"><span>Aufgabe</span><input name="title" required value={editing.title} /></label>
			<div class="form-grid">
				<label class="field"><span>Fällig</span><input name="dueDate" type="date" value={editing.dueDate ?? ''} /></label>
				<label class="field">
					<span>Meilenstein</span>
					<select name="milestoneId" value={editing.milestoneId ? String(editing.milestoneId) : ''}>
						<option value="">Ohne</option>
						{#each milestones as m (m.id)}<option value={String(m.id)}>{m.title}</option>{/each}
					</select>
				</label>
			</div>
			<label class="field"><span>Notizen</span><textarea name="notes" rows="4">{editing.notes ?? ''}</textarea></label>
			<div class="form-actions">
				<button class="btn danger" type="submit" formaction="?/aufgabe_loeschen"><Trash2 size={14} /> Löschen</button>
				<button class="btn" type="submit">Speichern</button>
			</div>
		</form>
	{/if}
</Modal>

<Modal bind:open={msOpen} title="Meilenstein bearbeiten">
	{#if msEdit}
		<form method="POST" action="?/meilenstein" class="stack" use:enhance={submit({ done: () => (msOpen = false) })}>
			<input type="hidden" name="id" value={msEdit.id} />
			<div class="form-grid">
				<label class="field"><span>Titel</span><input name="title" required value={msEdit.title} /></label>
				<label class="field"><span>Bis</span><input name="dueDate" type="date" value={msEdit.dueDate ?? ''} /></label>
			</div>
			<p class="small faint">Beim Löschen bleiben die Aufgaben erhalten.</p>
			<div class="form-actions">
				<button class="btn danger" type="submit" formaction="?/meilenstein_loeschen" formnovalidate><Trash2 size={14} /> Löschen</button>
				<button class="btn" type="submit">Speichern</button>
			</div>
		</form>
	{/if}
</Modal>

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

	.add .due {
		width: 9.5rem;
		min-height: 2.2rem;
		padding: 0.3rem 0.5rem;
	}

	.add .ms {
		width: 11rem;
		min-height: 2.2rem;
		padding: 0.3rem 0.5rem;
	}

	.group {
		padding: 0.9rem 1rem 0.6rem;
	}

	.group header {
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--line-soft);
	}

	.ms-title {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 650;
		font-size: 0.92rem;
	}

	.reached .ms-title {
		color: var(--ok);
	}

	.tasks {
		margin: 0;
		padding: 0.3rem 0 0;
		list-style: none;
	}

	.tasks li {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.4rem 0;
	}

	.task-title {
		flex: 1;
		min-width: 0;
		display: grid;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font-size: 0.92rem;
		text-align: left;
		cursor: pointer;
		transition: color 0.3s;
	}

	.task-title small {
		color: var(--dust-2);
		font-size: 0.78rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.task-title:hover {
		color: var(--accent);
	}

	.done .task-title {
		color: var(--dust-2);
		text-decoration: line-through;
		text-decoration-color: rgb(var(--accent-rgb) / 0.6);
	}

	.due-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.04);
		color: var(--dust);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.due-chip.today {
		color: var(--warn);
		background: rgb(var(--warn-rgb) / 0.1);
	}

	.late {
		color: var(--danger) !important;
	}

	.due-chip.late {
		background: rgb(var(--danger-rgb) / 0.1);
	}

	.none {
		padding: 0.5rem 0;
	}

	.progress-card {
		display: flex;
		align-items: center;
		gap: 1.2rem;
	}

	.ring {
		width: 6.5rem;
		height: 6.5rem;
		flex: none;
		rotate: -90deg;
	}

	.ring circle {
		fill: none;
		stroke-width: 9;
	}

	.ring .bg {
		stroke: rgb(39 50 95 / 0.6);
	}

	.ring .fg {
		stroke-linecap: round;
		stroke-dasharray: 314;
		transition: stroke-dashoffset 1s var(--ease-out);
		filter: drop-shadow(0 0 6px rgb(143 155 255 / 0.5));
	}

	.pct {
		font-family: var(--font-display);
		font-stretch: 115%;
		font-weight: 700;
		font-size: 1.8rem;
	}

	@media (max-width: 640px) {
		.add {
			flex-wrap: wrap;
		}
		.add .due,
		.add .ms {
			flex: 1;
			width: auto;
		}
	}
</style>
