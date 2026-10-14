<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import {
		CalendarDays,
		FileSignature,
		FolderKanban,
		Globe,
		Inbox,
		LayoutDashboard,
		ListChecks,
		LogOut,
		Menu,
		ReceiptText,
		Search,
		Server,
		Settings,
		SquareKanban,
		Timer,
		Users,
		X
	} from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';
	import Bell from '$lib/components/Bell.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import TimerWidget from '$lib/components/TimerWidget.svelte';

	let { data, children } = $props();

	const nav = $derived([
		{ href: '/', label: 'Cockpit', icon: LayoutDashboard },
		{ href: '/pipeline', label: 'Pipeline', icon: SquareKanban, badge: data.badges.anfragen, tone: 'accent' },
		{ href: '/projekte', label: 'Projekte', icon: FolderKanban },
		{ href: '/kunden', label: 'Kunden', icon: Users },
		{ href: '/aufgaben', label: 'Aufgaben', icon: ListChecks },
		{ href: '/zeiten', label: 'Zeiten', icon: Timer },
		{ href: '/termine', label: 'Termine', icon: CalendarDays },
		{ href: '/posteingang', label: 'Posteingang', icon: Inbox, badge: data.badges.mails, tone: 'info' },
		{ href: '/rechnungen', label: 'Angebote & Rechnungen', icon: ReceiptText, badge: data.badges.ueberfaellig, tone: 'warn' },
		{ href: '/vertraege', label: 'Verträge', icon: FileSignature },
		{ href: '/hosting', label: 'Hosting & Wartung', icon: Server, badge: data.badges.offline, tone: 'danger' },
		{ href: '/webseite', label: 'Webseite', icon: Globe },
		{ href: '/einstellungen', label: 'Einstellungen', icon: Settings }
	]);

	const mobileNav = $derived(nav.filter((n) => ['/', '/pipeline', '/projekte', '/posteingang'].includes(n.href)));

	const isActive = (href: string) => (href === '/' ? page.url.pathname === '/' : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`));

	let paletteOpen = $state(false);
	let drawer = $state(false);

	// Navigation schließt das Menü am Handy
	$effect(() => {
		void page.url.pathname;
		drawer = false;
	});

	// Zähler und Glocke aktuell halten
	$effect(() => {
		const tick = () => !document.hidden && invalidate('app:shell');
		const id = setInterval(tick, 30_000);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', tick);
		};
	});

	function onKey(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			paletteOpen = !paletteOpen;
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="shell">
	<aside class="sidebar" aria-label="Hauptnavigation">
		<a class="brand" href="/">
			<span class="mark"><Mark size={32} /></span>
			<span class="name">
				<span class="word">Astronox</span>
				<span class="tag">Portal</span>
			</span>
		</a>
		<nav>
			{#each nav as item, i (item.href)}
				<a href={item.href} class:active={isActive(item.href)} aria-current={isActive(item.href) ? 'page' : undefined} style="--i: {i}">
					<item.icon size={18} />
					<span>{item.label}</span>
					{#if item.badge}<b class="count {item.tone}">{item.badge}</b>{/if}
				</a>
			{/each}
		</nav>
		<div class="me">
			<span class="avatar">{data.user.name.slice(0, 1)}</span>
			<div class="who">
				<strong>{data.user.name}</strong>
				<small>{data.user.email}</small>
			</div>
			<form method="POST" action="/abmelden">
				<button class="btn quiet icon sm" type="submit" title="Abmelden" aria-label="Abmelden"><LogOut size={17} /></button>
			</form>
		</div>
	</aside>

	<div class="main">
		<header class="topbar">
			<a class="brand-mobile" href="/" aria-label="Cockpit"><Mark size={28} /></a>
			<button class="search" type="button" onclick={() => (paletteOpen = true)}>
				<Search size={17} />
				<span>Suchen oder springen …</span>
				<kbd>Strg K</kbd>
			</button>
			<div class="tools">
				<TimerWidget timer={data.timer} />
				<Bell notifications={data.notifications} />
			</div>
		</header>

		{@render children()}
	</div>

	<nav class="tabbar" aria-label="Navigation">
		{#each mobileNav as item (item.href)}
			<a href={item.href} class:active={isActive(item.href)}>
				<span class="ico"><item.icon size={21} />{#if item.badge}<b class="dot {item.tone}"></b>{/if}</span>
				<span>{item.label}</span>
			</a>
		{/each}
		<button type="button" onclick={() => (drawer = true)} class:active={!mobileNav.some((n) => isActive(n.href))}>
			<span class="ico"><Menu size={21} /></span>
			<span>Mehr</span>
		</button>
	</nav>
</div>

{#if drawer}
	<div class="drawer-bg" transition:fade={{ duration: 180 }} onclick={() => (drawer = false)} role="presentation"></div>
	<div class="drawer" transition:fly={{ y: 300, duration: 380 }} role="dialog" aria-modal="true" aria-label="Menü">
		<div class="spread">
			<strong>Alle Bereiche</strong>
			<button class="btn quiet icon sm" type="button" aria-label="Schließen" onclick={() => (drawer = false)}><X size={18} /></button>
		</div>
		<div class="drawer-grid">
			{#each nav as item (item.href)}
				<a href={item.href} class:active={isActive(item.href)}>
					<item.icon size={20} />
					<span>{item.label}</span>
					{#if item.badge}<b class="count {item.tone}">{item.badge}</b>{/if}
				</a>
			{/each}
		</div>
		<form method="POST" action="/abmelden">
			<button class="btn ghost" type="submit" style="width: 100%"><LogOut size={16} /> Abmelden</button>
		</form>
	</div>
{/if}

<CommandPalette bind:open={paletteOpen} />

<style>
	.shell {
		display: grid;
		grid-template-columns: var(--sidebar) minmax(0, 1fr);
		min-height: 100svh;
	}

	/* ---------------------------------------------------- Seitenleiste */
	.sidebar {
		position: sticky;
		top: 0;
		display: flex;
		flex-direction: column;
		height: 100svh;
		padding: 1.1rem 0.75rem 0.9rem;
		border-right: 1px solid var(--line-soft);
		background: linear-gradient(180deg, rgb(11 19 48 / 0.82), rgb(7 13 36 / 0.9));
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		padding: 0.2rem 0.6rem 1.2rem;
		text-decoration: none;
	}

	/* Schriftzug mit „Portal“ darunter – passt in die schmale Leiste */
	.name {
		display: grid;
		gap: 0.3rem;
		min-width: 0;
		line-height: 1;
	}

	.mark {
		display: grid;
		transition: rotate 0.8s var(--ease-spring);
	}

	.brand:hover .mark {
		rotate: 90deg;
	}

	.word {
		font-family: var(--font-display);
		font-weight: 760;
		font-stretch: 140%;
		font-size: 1.08rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.tag {
		color: var(--accent);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
	}

	nav {
		display: grid;
		gap: 0.15rem;
		overflow-y: auto;
		margin: 0 -0.25rem;
		padding: 0 0.25rem;
	}

	nav a {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		color: var(--dust);
		font-size: 0.9rem;
		font-weight: 500;
		text-decoration: none;
		transition:
			color 0.2s,
			background-color 0.25s;
		animation: rise 0.5s var(--ease-out) both;
		animation-delay: calc(var(--i) * 30ms);
	}

	nav a:hover {
		color: var(--star);
		background: rgb(255 255 255 / 0.04);
	}

	nav a.active {
		color: var(--star);
		background: linear-gradient(90deg, rgb(var(--accent-rgb) / 0.14), rgb(143 155 255 / 0.08) 60%, transparent);
	}

	/* Leuchtender Strich am aktiven Eintrag */
	nav a.active::before {
		content: '';
		position: absolute;
		left: -0.25rem;
		top: 22%;
		bottom: 22%;
		width: 3px;
		border-radius: 3px;
		background: var(--grad);
		box-shadow: 0 0 12px rgb(var(--accent-rgb) / 0.8);
		animation: beam 0.45s var(--ease-spring) both;
	}

	nav a.active :global(svg) {
		color: var(--accent);
		filter: drop-shadow(0 0 6px rgb(var(--accent-rgb) / 0.6));
	}

	nav a span {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		--c: var(--accent);
		min-width: 1.35rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--c) 20%, transparent);
		color: var(--c);
		font-size: 0.72rem;
		line-height: 1.35rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.count.info {
		--c: var(--sky);
	}
	.count.warn {
		--c: var(--warn);
	}
	.count.danger {
		--c: var(--danger);
		animation: pulse 2s ease-in-out infinite;
	}

	.me {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: auto;
		padding: 0.7rem 0.4rem 0;
		border-top: 1px solid var(--line-soft);
	}

	.avatar {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 50%;
		background: var(--grad);
		color: var(--night);
		font-weight: 700;
	}

	.who {
		flex: 1;
		min-width: 0;
		display: grid;
		line-height: 1.25;
	}

	.who strong {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.who small {
		color: var(--dust-2);
		font-size: 0.74rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* ---------------------------------------------------- Kopfleiste */
	.main {
		min-width: 0;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: var(--topbar);
		padding: 0 var(--gutter);
		background: linear-gradient(180deg, rgb(11 19 48 / 0.9), rgb(11 19 48 / 0.6));
		backdrop-filter: blur(14px) saturate(1.2);
		-webkit-backdrop-filter: blur(14px) saturate(1.2);
		border-bottom: 1px solid var(--line-soft);
	}

	.brand-mobile {
		display: none;
	}

	.search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex: 0 1 26rem;
		min-width: 0;
		height: 2.35rem;
		padding: 0 0.6rem 0 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
		color: var(--dust-2);
		font-size: 0.88rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			box-shadow 0.3s;
	}

	.search:hover {
		border-color: var(--nebula);
		box-shadow: 0 0 0 4px var(--nebula-soft);
	}

	.search span {
		flex: 1;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	/* ---------------------------------------------------- Handy */
	.tabbar {
		display: none;
	}

	@media (max-width: 960px) {
		.shell {
			grid-template-columns: minmax(0, 1fr);
		}
		.sidebar {
			display: none;
		}
		.brand-mobile {
			display: grid;
		}
		.search kbd {
			display: none;
		}
		.tabbar {
			position: fixed;
			inset: auto 0 0;
			z-index: 60;
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			padding: 0.35rem 0.4rem calc(0.35rem + env(safe-area-inset-bottom));
			background: rgb(9 15 40 / 0.9);
			backdrop-filter: blur(18px) saturate(1.3);
			-webkit-backdrop-filter: blur(18px) saturate(1.3);
			border-top: 1px solid var(--line-soft);
		}
		.tabbar a,
		.tabbar button {
			display: grid;
			justify-items: center;
			gap: 0.15rem;
			padding: 0.3rem 0;
			border: 0;
			border-radius: 12px;
			background: transparent;
			color: var(--dust-2);
			font-size: 0.66rem;
			text-decoration: none;
			cursor: pointer;
			-webkit-tap-highlight-color: transparent;
		}
		.tabbar .active {
			color: var(--star);
		}
		.tabbar .active .ico {
			color: var(--accent);
			background: var(--accent-soft);
		}
		.ico {
			position: relative;
			display: grid;
			place-items: center;
			width: 3rem;
			height: 1.8rem;
			border-radius: 999px;
			transition: background-color 0.3s;
		}
		.dot {
			position: absolute;
			top: 0.1rem;
			right: 0.75rem;
			width: 0.5rem;
			height: 0.5rem;
			border-radius: 50%;
			background: var(--accent);
			box-shadow: 0 0 8px var(--accent);
		}
		.dot.info {
			background: var(--sky);
		}
	}

	.drawer-bg {
		position: fixed;
		inset: 0;
		z-index: 90;
		background: rgb(5 9 26 / 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.drawer {
		position: fixed;
		inset: auto 0 0;
		z-index: 91;
		display: grid;
		gap: 1rem;
		padding: 1.1rem 1rem calc(1.1rem + env(safe-area-inset-bottom));
		border-radius: 22px 22px 0 0;
		border-top: 1px solid var(--line);
		background: var(--glass-strong);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.drawer-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.drawer-grid a {
		position: relative;
		display: grid;
		justify-items: center;
		gap: 0.35rem;
		padding: 0.85rem 0.3rem;
		border: 1px solid var(--line-soft);
		border-radius: 14px;
		color: var(--dust);
		font-size: 0.74rem;
		text-align: center;
		text-decoration: none;
	}

	.drawer-grid a.active {
		color: var(--star);
		border-color: rgb(var(--accent-rgb) / 0.45);
		background: var(--accent-soft);
	}

	.drawer-grid .count {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
	}

	@keyframes beam {
		from {
			scale: 1 0;
			opacity: 0;
		}
	}

	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 4px rgb(var(--danger-rgb) / 0.18);
		}
	}
</style>
