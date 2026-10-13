<script lang="ts">
	import { ArrowUpRight, CalendarDays, CircleCheck, Clock, Eye, ListChecks, Server, Sparkles, SquareKanban, TriangleAlert, Wallet } from '@lucide/svelte';
	import AreaLine from '$lib/components/AreaLine.svelte';
	import Columns from '$lib/components/Columns.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { date, dateShort, hours, moneyShort, monthLabel, number, relative, time, today } from '$lib/shared/format';
	import { STAGES } from '$lib/shared/stages';
	import { countUp, glow, tilt } from '$lib/ui/actions';

	let { data } = $props();

	const hour = Number(new Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
	const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
	const firstName = $derived(data.user.name.split(' ')[0]);

	const k = $derived(data.kpi);
	const visitsTotal = $derived(data.visits.reduce((s, v) => s + v.value, 0));
	const openStages = STAGES.filter((s) => s.id !== 'abgeschlossen' && s.id !== 'verloren');
	const stageMax = $derived(Math.max(1, ...openStages.map((s) => data.stages[s.id] ?? 0)));
	const monShort = new Intl.DateTimeFormat('de-AT', { month: 'short', timeZone: 'UTC' });
</script>

<svelte:head><title>Cockpit – Astronox Portal</title></svelte:head>

<div class="page">
	<header class="hello">
		<p class="date">{dateShort(today())}</p>
		<h1>{greeting}, <span class="grad-text">{firstName}</span>.</h1>
		<p class="lead">
			{#if k.newLeads}
				{k.newLeads === 1 ? 'Eine neue Anfrage wartet' : `${k.newLeads} neue Anfragen warten`} in der <a href="/pipeline">Pipeline</a>.
			{:else if data.dueTasks.length}
				{data.dueTasks.length} Aufgaben sind in den nächsten Tagen fällig.
			{:else}
				Alles ruhig im Orbit. Zeit für Deep Work.
			{/if}
		</p>
	</header>

	<section class="grid-4 stagger kpis">
		<a class="card kpi" href="/pipeline" use:glow use:tilt style="--i: 0; --c: var(--accent)">
			<span class="icon"><SquareKanban size={18} /></span>
			<p class="label">Offene Anfragen</p>
			<p class="value num" use:countUp={{ value: k.leads }}>0</p>
			<p class="foot">Pipeline-Wert {moneyShort(k.pipelineValue)}</p>
		</a>
		<a class="card kpi" href="/projekte" use:glow use:tilt style="--i: 1; --c: var(--violet)">
			<span class="icon"><Sparkles size={18} /></span>
			<p class="label">Projekte in Arbeit</p>
			<p class="value num" use:countUp={{ value: k.active }}>0</p>
			<p class="foot">{k.open} offen insgesamt</p>
		</a>
		<a class="card kpi" href="/rechnungen" use:glow use:tilt style="--i: 2; --c: var(--pink)">
			<span class="icon"><Wallet size={18} /></span>
			<p class="label">Umsatz {today().slice(0, 4)} <small>netto</small></p>
			<p class="value num" use:countUp={{ value: k.revenueYear, format: (n) => moneyShort(n) }}>€ 0</p>
			<p class="foot">{k.openItemsCount ? `${moneyShort(k.openItems)} offen (${k.openItemsCount})` : 'Keine offenen Rechnungen'}</p>
		</a>
		<a class="card kpi" href="/zeiten" use:glow use:tilt style="--i: 3; --c: var(--sky)">
			<span class="icon"><Clock size={18} /></span>
			<p class="label">Stunden im {monthLabel(today().slice(0, 7)).split(' ')[0]}</p>
			<p class="value num" use:countUp={{ value: k.minutesMonth / 60, format: (n) => number(Math.round(n * 10) / 10) }}>0</p>
			<p class="foot">{hours(k.minutesMonth)} h erfasst</p>
		</a>
	</section>

	<section class="split">
		<div class="stack">
			<div class="card" use:glow>
				<div class="card-head">
					<h2><Wallet size={17} /> Umsatz der letzten 12 Monate</h2>
					<span class="small faint">netto, nach Rechnungsdatum</span>
				</div>
				<Columns
					label="Umsatz je Monat"
					data={data.revenue.map((r) => ({ label: monthLabel(r.month), short: monShort.format(new Date(`${r.month}-01T00:00:00Z`)).replace('.', ''), value: r.value }))}
					format={(n) => moneyShort(n)}
					highlight={11}
					minMax={100_000}
					emptyText="Sobald Rechnungen festgeschrieben sind, wächst hier der Umsatz."
				/>
			</div>

			<div class="card" use:glow>
				<div class="card-head">
					<h2><SquareKanban size={17} /> Pipeline</h2>
					<a class="btn quiet sm" href="/pipeline">Board <ArrowUpRight size={14} /></a>
				</div>
				<ul class="funnel">
					{#each openStages as s, i (s.id)}
						<li style="--c: {s.color}; --w: {((data.stages[s.id] ?? 0) / stageMax) * 100}%; --i: {i}">
							<a href="/pipeline#{s.id}">
								<span class="name">{s.label}</span>
								<span class="track"><i></i></span>
								<span class="n num">{data.stages[s.id] ?? 0}</span>
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<div class="card" use:glow>
				<div class="card-head">
					<h2><Sparkles size={17} /> Zuletzt passiert</h2>
				</div>
				<Timeline items={data.recent} context compact />
			</div>
		</div>

		<div class="stack">
			<div class="card" use:glow>
				<div class="card-head">
					<h2><CalendarDays size={17} /> Nächste Termine</h2>
					<a class="btn quiet sm" href="/termine">Alle <ArrowUpRight size={14} /></a>
				</div>
				{#if data.upcoming.length}
					<ul class="list agenda">
						{#each data.upcoming as b (b.id)}
							<li>
								<span class="when"><strong>{dateShort(b.startsAt)}</strong><small>{time(b.startsAt)} Uhr</small></span>
								<span class="who">
									<strong>{b.company || b.name}</strong>
									<small>{b.kind === 'video' ? 'Video-Call' : 'Telefon'} · {relative(b.startsAt)}</small>
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="small muted">Keine Erstgespräche geplant.</p>
				{/if}
			</div>

			<div class="card" use:glow>
				<div class="card-head">
					<h2><ListChecks size={17} /> Fällig</h2>
					<a class="btn quiet sm" href="/aufgaben">Alle <ArrowUpRight size={14} /></a>
				</div>
				{#if data.dueTasks.length}
					<ul class="list due">
						{#each data.dueTasks as t (t.id)}
							<li class:late={t.dueDate! < today()}>
								<a href="/projekte/{t.projectId}?tab=aufgaben">
									<span><strong>{t.title}</strong><small>{t.project}</small></span>
									<time>{t.dueDate! < today() ? `seit ${date(t.dueDate)}` : relative(t.dueDate)}</time>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="small muted row"><CircleCheck size={16} /> Nichts fällig in den nächsten 7 Tagen.</p>
				{/if}
			</div>

			<div class="card" use:glow>
				<div class="card-head">
					<h2><Eye size={17} /> Besuche auf astronox.dev</h2>
					<span class="num small">{number(visitsTotal)} in 30 Tagen</span>
				</div>
				<AreaLine label="Seitenaufrufe je Tag" data={data.visits.map((v) => ({ label: date(v.day), value: v.value }))} format={(n) => `${number(n)} Aufrufe`} height={110} />
				<a class="more small" href="/webseite/statistik">Statistik ansehen</a>
			</div>

			<div class="card" use:glow>
				<div class="card-head">
					<h2><Server size={17} /> Hosting</h2>
					<a class="btn quiet sm" href="/hosting">Übersicht <ArrowUpRight size={14} /></a>
				</div>
				<div class="row wrap">
					<span class="badge ok dot">{data.monitors.online ?? 0} online</span>
					{#if data.monitors.offline}<span class="badge danger dot">{data.monitors.offline} offline</span>{/if}
					{#if data.monitors.unbekannt}<span class="badge muted">{data.monitors.unbekannt} ungeprüft</span>{/if}
				</div>
				{#if data.expiring.length}
					<ul class="list expiring">
						{#each data.expiring as d (d.name)}
							<li><TriangleAlert size={14} /> {d.name} läuft am {date(d.expiresOn)} ab</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</section>
</div>

<style>
	.hello {
		padding: 0.5rem 0 0.25rem;
	}

	.date {
		color: var(--dust-2);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.hello h1 {
		margin-top: 0.4rem;
		font-size: clamp(1.7rem, 1.3rem + 1.6vw, 2.5rem);
	}

	.hello .lead {
		margin-top: 0.5rem;
		color: var(--dust);
	}

	.hello .lead a {
		color: var(--accent);
	}

	/* Farbiger Schein in der Ecke jeder Kennzahl */
	.kpi {
		display: grid;
		gap: 0.2rem;
		background:
			radial-gradient(circle at 105% -10%, color-mix(in srgb, var(--c) 20%, transparent), transparent 55%),
			var(--glass);
	}

	.icon {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		margin-bottom: 0.5rem;
		border-radius: 10px;
		background: color-mix(in srgb, var(--c) 15%, transparent);
		color: var(--c);
		box-shadow: 0 0 22px -6px var(--c);
	}

	.label {
		color: var(--dust);
		font-size: 0.85rem;
	}

	.label small {
		color: var(--dust-2);
	}

	.value {
		font-family: var(--font-display);
		font-stretch: 112%;
		font-weight: 700;
		font-size: clamp(1.6rem, 1.3rem + 1vw, 2.15rem);
		line-height: 1.15;
	}

	.foot {
		color: var(--dust-2);
		font-size: 0.8rem;
	}

	.funnel {
		display: grid;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.funnel a {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr) 2rem;
		align-items: center;
		gap: 0.8rem;
		padding: 0.3rem 0.4rem;
		border-radius: 8px;
		text-decoration: none;
		font-size: 0.87rem;
	}

	.funnel a:hover {
		background: rgb(255 255 255 / 0.03);
	}

	.name {
		color: var(--dust);
	}

	.track {
		height: 0.55rem;
		border-radius: 999px;
		background: rgb(39 50 95 / 0.45);
		overflow: hidden;
	}

	.track i {
		display: block;
		width: max(var(--w), 0.55rem);
		height: 100%;
		border-radius: 999px;
		background: var(--c);
		box-shadow: 0 0 14px -2px var(--c);
		transform-origin: left;
		animation: grow 1s var(--ease-out) both;
		animation-delay: calc(var(--i) * 70ms + 150ms);
	}

	.n {
		text-align: right;
		font-weight: 600;
	}

	.agenda li,
	.due li {
		padding: 0.55rem 0;
	}

	.agenda li {
		display: grid;
		grid-template-columns: 6.5rem minmax(0, 1fr);
		gap: 0.8rem;
	}

	.when,
	.who {
		display: grid;
		line-height: 1.3;
	}

	.when strong {
		font-size: 0.85rem;
	}

	.when small,
	.who small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.who strong {
		font-size: 0.9rem;
		font-weight: 550;
	}

	.due a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		text-decoration: none;
	}

	.due a span {
		display: grid;
		line-height: 1.3;
		min-width: 0;
	}

	.due strong {
		font-size: 0.88rem;
		font-weight: 550;
	}

	.due small {
		color: var(--dust-2);
		font-size: 0.78rem;
	}

	.due time {
		color: var(--dust);
		font-size: 0.78rem;
		white-space: nowrap;
	}

	.due .late time {
		color: var(--danger);
	}

	.due a:hover strong {
		color: var(--accent);
	}

	.more {
		display: inline-block;
		margin-top: 0.5rem;
		color: var(--dust);
	}

	.more:hover {
		color: var(--accent);
	}

	.expiring {
		margin-top: 0.75rem;
		font-size: 0.85rem;
		color: var(--warn);
	}

	.expiring li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0;
	}
</style>
