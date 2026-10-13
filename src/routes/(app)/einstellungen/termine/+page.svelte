<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarClock, Copy, Link, Plus, X } from '@lucide/svelte';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	let { data } = $props();
	const t = $derived(data.termine);

	// Montag zuerst
	const DAYS = [
		{ wd: 1, label: 'Montag' },
		{ wd: 2, label: 'Dienstag' },
		{ wd: 3, label: 'Mittwoch' },
		{ wd: 4, label: 'Donnerstag' },
		{ wd: 5, label: 'Freitag' },
		{ wd: 6, label: 'Samstag' },
		{ wd: 0, label: 'Sonntag' }
	];

	const toWeek = () => {
		const w: Record<number, { from: string; to: string }[]> = {};
		for (const d of DAYS) w[d.wd] = data.termine.hours.filter((h) => h.weekday === d.wd).map((h) => ({ from: h.from, to: h.to }));
		return w;
	};
	let week = $state(toWeek());
	$effect(() => {
		week = toWeek();
	});
	const json = $derived(JSON.stringify(DAYS.flatMap((d) => (week[d.wd] ?? []).map((r) => ({ weekday: d.wd, ...r })))));
	const slots = $derived(
		DAYS.reduce((s, d) => s + (week[d.wd] ?? []).reduce((a, r) => {
			const m = (x: string) => Number(x.split(':')[0]) * 60 + Number(x.split(':')[1]);
			return a + Math.max(0, Math.floor((m(r.to) - m(r.from)) / Math.max(1, t.duration + t.buffer)));
		}, 0), 0)
	);

	async function copyFeed() {
		await navigator.clipboard.writeText(data.feed!);
		toast('Abo-Adresse kopiert');
	}
</script>

<svelte:head><title>Termine – Einstellungen</title></svelte:head>

<form method="POST" action="?/speichern" class="card stack" use:glow use:enhance={submit()}>
	<h2><CalendarClock size={17} /> Buchbare Zeiten für das Erstgespräch</h2>
	<p class="small muted">So viele freie Fenster pro Woche: <strong>{slots}</strong>. Urlaub und einzelne Tage sperrst du unter <a href="/termine">Termine</a>.</p>
	<input type="hidden" name="hours" value={json} />
	<div class="week">
		{#each DAYS as d (d.wd)}
			<div class="day" class:off={!week[d.wd]?.length}>
				<label class="switch">
					<input
						type="checkbox"
						checked={!!week[d.wd]?.length}
						onchange={(e) => (week[d.wd] = e.currentTarget.checked ? [{ from: '16:00', to: '19:00' }] : [])}
					/>
					{d.label}
				</label>
				<div class="ranges">
					{#each week[d.wd] ?? [] as r, i (i)}
						<span class="range">
							<input class="input" type="time" bind:value={r.from} step="900" />
							<span>–</span>
							<input class="input" type="time" bind:value={r.to} step="900" />
							<button class="btn quiet icon sm" type="button" aria-label="Zeitraum entfernen" onclick={() => week[d.wd].splice(i, 1)}><X size={13} /></button>
						</span>
					{/each}
					{#if week[d.wd]?.length}
						<button class="btn quiet sm" type="button" onclick={() => week[d.wd].push({ from: '09:00', to: '12:00' })}><Plus size={13} /> Zeitraum</button>
					{:else}
						<span class="small faint">nicht buchbar</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<div class="form-grid-3">
		<label class="field"><span>Dauer (Minuten)</span><input name="duration" type="number" min="10" max="240" step="5" value={t.duration} /></label>
		<label class="field"><span>Pause danach (Minuten)</span><input name="buffer" type="number" min="0" max="120" step="5" value={t.buffer} /></label>
		<label class="field"><span>Frühestens (Stunden vorher)</span><input name="leadHours" type="number" min="0" value={t.leadHours} /></label>
		<label class="field"><span>Buchbar für (Tage)</span><input name="days" type="number" min="1" max="180" value={t.days} /></label>
		<label class="field full" style="grid-column: span 2"><span>Link zum Video-Raum <small>(kommt in Bestätigung und Kalendereintrag)</small></span><input name="videoLink" value={t.videoLink} placeholder="https://meet.jit.si/…" /></label>
	</div>
	<label class="switch"><input type="checkbox" name="holidays" checked={t.holidays} /> Österreichische Feiertage sowie 24. und 31.12. automatisch sperren</label>
	<div class="form-actions"><button class="btn" type="submit">Speichern</button></div>
</form>

<div class="card stack" use:glow>
	<h2><Link size={17} /> Kalender-Abo</h2>
	<p class="small muted">Alle gebuchten Erstgespräche in Outlook, Google oder Apple Kalender abonnieren.</p>
	{#if data.feed}
		<div class="feed">
			<code class="mono">{data.feed.replace(/schluessel=.{6}.*/, 'schluessel=••••••')}</code>
			<button class="btn ghost sm" type="button" onclick={copyFeed}><Copy size={14} /> Kopieren</button>
		</div>
	{/if}
	<div class="row">
		<form method="POST" action="?/abo" use:enhance={submit(data.feed ? { confirm: 'Neue Adresse erzeugen?', confirmDetail: 'Bestehende Abos funktionieren dann nicht mehr.' } : {})}>
			<button class="btn ghost sm" type="submit">{data.feed ? 'Neue Adresse erzeugen' : 'Abo einschalten'}</button>
		</form>
		{#if data.feed}
			<form method="POST" action="?/abo" use:enhance={submit()}>
				<input type="hidden" name="aus" value="on" />
				<button class="btn quiet sm" type="submit">Abschalten</button>
			</form>
		{/if}
	</div>
</div>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.muted a {
		color: var(--accent);
	}

	.week {
		display: grid;
		gap: 0.4rem;
	}

	.day {
		display: grid;
		grid-template-columns: 10rem minmax(0, 1fr);
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-soft);
		border-radius: 12px;
		transition: opacity 0.25s;
	}

	.day.off {
		opacity: 0.65;
	}

	.ranges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.range {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.range .input {
		width: 6.5rem;
		min-height: 2.1rem;
		padding: 0.25rem 0.5rem;
	}

	.feed {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--line);
		border-radius: 10px;
	}

	.feed code {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--dust);
	}

	@media (max-width: 640px) {
		.day {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.5rem;
		}
	}
</style>
