<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarDays, CalendarOff, CalendarX2, Copy, Phone, Settings, Video, X } from '@lucide/svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { date, dateShort, relative, time, today } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	let { data } = $props();
	type B = (typeof data.upcoming)[number];
	let cancel = $state<B | null>(null);
	let cancelOpen = $state(false);

	// nach Tagen gruppieren
	const days = $derived.by(() => {
		const map = new Map<string, B[]>();
		for (const b of data.upcoming) {
			const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date(b.startsAt));
			map.set(d, [...(map.get(d) ?? []), b]);
		}
		return [...map.entries()];
	});

	async function copyFeed() {
		await navigator.clipboard.writeText(data.feed!);
		toast('Abo-Adresse kopiert');
	}
</script>

<svelte:head><title>Termine – Astronox Portal</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Termine</h1>
			<p class="lead">Erstgespräche, die über astronox.dev gebucht wurden.</p>
		</div>
		<div class="actions">
			{#if data.feed}<button class="btn ghost sm" type="button" onclick={copyFeed}><Copy size={15} /> Kalender-Abo</button>{/if}
			<a class="btn ghost sm" href="/einstellungen/termine"><Settings size={15} /> Buchbare Zeiten</a>
		</div>
	</div>

	<div class="split">
		<div class="stack">
			{#each days as [day, list], gi (day)}
				<section class="card day" use:glow style="--i: {gi}">
					<h2>{dateShort(day)} <span class="faint small">{relative(day)}</span></h2>
					<ul class="list">
						{#each list as b (b.id)}
							<li class:off={b.status === 'abgesagt'}>
								<span class="time num">{time(b.startsAt)}<small>– {time(b.endsAt)}</small></span>
								<span class="kind">{#if b.kind === 'video'}<Video size={16} />{:else}<Phone size={16} />{/if}</span>
								<span class="who">
									<strong>{b.company ? `${b.company} · ${b.name}` : b.name}</strong>
									<small>{b.email}{b.phone ? ` · ${b.phone}` : ''}</small>
									{#if b.message}<small class="msg">{b.message}</small>{/if}
								</span>
								<span class="row">
									{#if b.status === 'abgesagt'}
										<span class="badge muted">abgesagt</span>
									{:else}
										{#if b.projectId}<a class="btn quiet sm" href="/projekte/{b.projectId}">Projekt</a>{/if}
										<button
											class="btn quiet icon sm"
											type="button"
											aria-label="Absagen"
											onclick={() => {
												cancel = b;
												cancelOpen = true;
											}}><CalendarX2 size={16} /></button
										>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{:else}
				<div class="card empty">
					<CalendarDays size={30} />
					<p>Keine anstehenden Termine.</p>
				</div>
			{/each}

			{#if data.past.length}
				<details class="card past">
					<summary>Vergangene Termine ({data.past.length})</summary>
					<ul class="list">
						{#each data.past as b (b.id)}
							<li class="small" class:off={b.status === 'abgesagt'}>
								<span>{date(b.startsAt)} {time(b.startsAt)}</span>
								<span>{b.company || b.name}</span>
								{#if b.projectId}<a href="/projekte/{b.projectId}">Projekt</a>{/if}
								{#if b.status === 'abgesagt'}<span class="badge muted">abgesagt</span>{/if}
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</div>

		<div class="stack">
			<form method="POST" action="?/abwesenheit" class="card stack" use:glow use:enhance={submit({ reset: true })}>
				<h2><CalendarOff size={16} /> Abwesenheit eintragen</h2>
				<p class="small muted">In diesem Zeitraum sind auf der Webseite keine Termine buchbar.</p>
				<div class="form-grid">
					<label class="field"><span>Von</span><input name="from" type="date" required min={today()} /></label>
					<label class="field"><span>Bis</span><input name="to" type="date" /></label>
					<label class="field full"><span>Notiz</span><input name="note" placeholder="z. B. Urlaub" /></label>
				</div>
				<div class="form-actions"><button class="btn ghost sm" type="submit">Sperren</button></div>
			</form>

			{#if data.blocked.length}
				<div class="card" use:glow>
					<h2>Gesperrt</h2>
					<ul class="list blocked">
						{#each data.blocked as bl, i (bl.from + i)}
							<li class:old={bl.to < today()}>
								<span>{date(bl.from)}{bl.to !== bl.from ? ` – ${date(bl.to)}` : ''}{bl.note ? ` · ${bl.note}` : ''}</span>
								<form method="POST" action="?/abwesenheit_loeschen" use:enhance={submit()}>
									<input type="hidden" name="index" value={i} />
									<button class="btn quiet icon sm" type="submit" aria-label="Entfernen"><X size={14} /></button>
								</form>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>
</div>

<Modal bind:open={cancelOpen} title="Termin absagen">
	{#if cancel}
		<form method="POST" action="?/absagen" class="stack" use:enhance={submit({ done: () => (cancelOpen = false) })}>
			<input type="hidden" name="id" value={cancel.id} />
			<p>{cancel.company || cancel.name} · {dateShort(cancel.startsAt)}, {time(cancel.startsAt)} Uhr</p>
			<label class="check"><input type="checkbox" name="notify" checked /> Absage per E-Mail an {cancel.email}</label>
			<label class="field"><span>Persönliche Nachricht <small>(optional)</small></span><textarea name="reason" rows="3" placeholder="z. B. Ich bin an diesem Tag leider krank."></textarea></label>
			<div class="form-actions"><button class="btn danger" type="submit">Absagen</button></div>
		</form>
	{/if}
</Modal>

<style>
	.day {
		animation: rise 0.5s var(--ease-out) both;
		animation-delay: calc(var(--i) * 50ms);
	}

	.day h2 {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 0.4rem;
	}

	.day li {
		display: grid;
		grid-template-columns: 4.2rem 2rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.65rem 0;
	}

	.off {
		opacity: 0.5;
	}

	.time {
		display: grid;
		font-weight: 650;
	}

	.time small {
		color: var(--dust-2);
		font-weight: 400;
		font-size: 0.75rem;
	}

	.kind {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: rgb(125 211 252 / 0.12);
		color: var(--sky);
	}

	.who {
		display: grid;
		line-height: 1.35;
		min-width: 0;
	}

	.who strong {
		font-weight: 600;
		font-size: 0.92rem;
	}

	.who small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.who .msg {
		color: var(--dust);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.past summary {
		cursor: pointer;
		color: var(--dust);
	}

	.past li {
		display: flex;
		flex-wrap: wrap;
		gap: 0.8rem;
		padding: 0.45rem 0;
	}

	.past a {
		color: var(--accent);
	}

	.blocked li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 0;
		font-size: 0.88rem;
	}

	.blocked .old {
		opacity: 0.5;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}
</style>
