<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Play, Square } from '@lucide/svelte';
	import { scale } from 'svelte/transition';
	import Modal from './Modal.svelte';
	import { api } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	/** Laufende Zeiterfassung in der Kopfleiste – ein Timer zur Zeit */
	let { timer }: { timer: { id: number; startedAt: string; description: string | null; projectId: number; project: string } | null } = $props();

	let now = $state(Date.now());
	let open = $state(false);
	let projects = $state<{ id: number; title: string; customer: string }[]>([]);
	let projectId = $state('');
	let description = $state('');
	let busy = $state(false);

	$effect(() => {
		if (!timer) return;
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	const elapsed = $derived.by(() => {
		if (!timer) return '';
		const s = Math.max(0, Math.floor((now - Date.parse(timer.startedAt)) / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
	});

	async function openStart() {
		open = true;
		projects = await api('/api/projekte');
		if (!projectId && projects[0]) projectId = String(projects[0].id);
	}

	async function start(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		try {
			await api('/api/zeit', { action: 'start', projectId: Number(projectId), description });
			open = false;
			description = '';
			toast('Zeit läuft');
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	async function stop() {
		const r = await api<{ minutes: number }>('/api/zeit', { action: 'stop' });
		toast(`Gestoppt: ${Math.floor(r.minutes / 60)}:${String(r.minutes % 60).padStart(2, '0')} h erfasst`);
		await invalidateAll();
	}
</script>

{#if timer}
	<div class="running" in:scale={{ start: 0.8, duration: 300 }}>
		<span class="pulse" aria-hidden="true"></span>
		<a href="/projekte/{timer.projectId}" class="what" title={timer.description ?? timer.project}>{timer.project}</a>
		<span class="clock num">{elapsed}</span>
		<button class="btn icon sm stop" type="button" aria-label="Zeit stoppen" title="Stoppen" onclick={stop}><Square size={13} fill="currentColor" /></button>
	</div>
{:else}
	<button class="btn ghost sm start" type="button" onclick={openStart}><Play size={14} /> <span>Zeit starten</span></button>
{/if}

<Modal bind:open title="Zeit erfassen">
	<form class="stack" onsubmit={start}>
		<label class="field">
			<span>Projekt</span>
			<select bind:value={projectId} required>
				{#each projects as p (p.id)}<option value={String(p.id)}>{p.title} · {p.customer}</option>{/each}
			</select>
		</label>
		{#if !projects.length}<p class="small muted">Noch keine offenen Projekte – lege zuerst eines an.</p>{/if}
		<label class="field">
			<span>Woran arbeitest du? <small>(optional)</small></span>
			<input bind:value={description} placeholder="z. B. Startseite gestalten" />
		</label>
		<div class="form-actions">
			<button class="btn" class:busy type="submit" disabled={!projectId}><Play size={15} /> Starten</button>
		</div>
	</form>
</Modal>

<style>
	.running {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		height: 2.3rem;
		padding: 0 0.25rem 0 0.75rem;
		border: 1px solid rgb(var(--accent-rgb) / 0.45);
		border-radius: 999px;
		background: linear-gradient(90deg, rgb(var(--accent-rgb) / 0.12), rgb(143 155 255 / 0.08));
		box-shadow: 0 0 24px -8px rgb(var(--accent-rgb) / 0.6);
	}

	.pulse {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--accent);
		color: rgb(var(--accent-rgb) / 0.5);
		animation: pulse-ring 1.6s ease-out infinite;
	}

	.what {
		max-width: 11rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.82rem;
		color: var(--dust);
		text-decoration: none;
	}

	.what:hover {
		color: var(--star);
	}

	.clock {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--accent-strong);
	}

	.stop {
		--h: 1.8rem;
	}

	@media (max-width: 640px) {
		.what,
		.start span {
			display: none;
		}
		.start {
			width: 2rem;
			padding: 0;
		}
	}
</style>
