<script lang="ts">
	import { goto } from '$app/navigation';
	import { CornerDownLeft, FileText, FolderKanban, Mail, Plus, Search, User } from '@lucide/svelte';
	import { fade, scale } from 'svelte/transition';

	/** Schnellsuche (Strg + K): Kunden, Projekte, Belege, Mails und Sprungziele */
	let { open = $bindable(false) }: { open: boolean } = $props();

	interface Hit {
		kind: 'kunde' | 'projekt' | 'beleg' | 'mail' | 'aktion' | 'seite';
		title: string;
		sub?: string;
		href: string;
	}

	const pages: Hit[] = [
		{ kind: 'aktion', title: 'Neues Projekt', href: '/projekte?neu=1' },
		{ kind: 'aktion', title: 'Neuer Kunde', href: '/kunden?neu=1' },
		{ kind: 'aktion', title: 'Neues Angebot', href: '/rechnungen/neu?typ=angebot' },
		{ kind: 'aktion', title: 'Neue Rechnung', href: '/rechnungen/neu?typ=rechnung' },
		{ kind: 'aktion', title: 'Neue Ausgabe', href: '/einnahmen-ausgaben?tab=buchungen&neu=ausgabe' },
		{ kind: 'aktion', title: 'Neue Einnahme', href: '/einnahmen-ausgaben?tab=buchungen&neu=einnahme' },
		{ kind: 'seite', title: 'Cockpit', href: '/' },
		{ kind: 'seite', title: 'Pipeline', href: '/pipeline' },
		{ kind: 'seite', title: 'Projekte', href: '/projekte' },
		{ kind: 'seite', title: 'Kunden', href: '/kunden' },
		{ kind: 'seite', title: 'Aufgaben', href: '/aufgaben' },
		{ kind: 'seite', title: 'Zeiten', href: '/zeiten' },
		{ kind: 'seite', title: 'Termine', href: '/termine' },
		{ kind: 'seite', title: 'Posteingang', href: '/posteingang' },
		{ kind: 'seite', title: 'Angebote & Rechnungen', href: '/rechnungen' },
		{ kind: 'seite', title: 'Verträge', href: '/vertraege' },
		{ kind: 'seite', title: 'Einnahmen & Ausgaben', href: '/einnahmen-ausgaben' },
		{ kind: 'seite', title: 'Anlagenverzeichnis', href: '/einnahmen-ausgaben?tab=anlagen' },
		{ kind: 'seite', title: 'Hosting & Wartung', href: '/hosting' },
		{ kind: 'seite', title: 'Webseite bearbeiten', href: '/webseite' },
		{ kind: 'seite', title: 'Besucherstatistik', href: '/webseite/statistik' },
		{ kind: 'seite', title: 'Einstellungen', href: '/einstellungen' }
	];

	let q = $state('');
	let hits = $state<Hit[]>([]);
	let active = $state(0);
	let input = $state<HTMLInputElement>();
	let timer: ReturnType<typeof setTimeout>;

	const shown = $derived.by(() => {
		const needle = q.trim().toLowerCase();
		const local = pages.filter((p) => !needle || p.title.toLowerCase().includes(needle));
		return needle ? [...hits, ...local].slice(0, 14) : local;
	});

	$effect(() => {
		if (open) {
			q = '';
			hits = [];
			active = 0;
			setTimeout(() => input?.focus(), 30);
		}
	});

	function search() {
		clearTimeout(timer);
		active = 0;
		const needle = q.trim();
		if (needle.length < 2) {
			hits = [];
			return;
		}
		timer = setTimeout(async () => {
			const res = await fetch(`/api/suche?q=${encodeURIComponent(needle)}`);
			if (res.ok && q.trim() === needle) hits = await res.json();
		}, 160);
	}

	async function choose(h: Hit | undefined) {
		if (!h) return;
		open = false;
		await goto(h.href);
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			active = Math.min(shown.length - 1, active + 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(0, active - 1);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			void choose(shown[active]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	const icon = { kunde: User, projekt: FolderKanban, beleg: FileText, mail: Mail, aktion: Plus, seite: CornerDownLeft };
</script>

{#if open}
	<div class="bg" transition:fade={{ duration: 150 }} onclick={() => (open = false)} role="presentation"></div>
	<div class="palette" role="dialog" aria-modal="true" aria-label="Suche" transition:scale={{ start: 0.96, duration: 200 }}>
		<div class="bar">
			<Search size={18} />
			<input bind:this={input} bind:value={q} oninput={search} onkeydown={onKey} placeholder="Kunde, Projekt, Rechnungsnummer, Mail …" aria-label="Suchbegriff" />
			<kbd>Esc</kbd>
		</div>
		<ul class="results" role="listbox">
			{#each shown as h, i (h.kind + h.href + h.title)}
				{@const Icon = icon[h.kind]}
				<li role="option" aria-selected={i === active}>
					<button type="button" class:active={i === active} onmouseenter={() => (active = i)} onclick={() => choose(h)}>
						<span class="ico {h.kind}"><Icon size={16} /></span>
						<span class="txt"><strong>{h.title}</strong>{#if h.sub}<small>{h.sub}</small>{/if}</span>
						<span class="kind">{{ kunde: 'Kunde', projekt: 'Projekt', beleg: 'Beleg', mail: 'Mail', aktion: 'Neu', seite: 'Seite' }[h.kind]}</span>
					</button>
				</li>
			{:else}
				<li class="none">Nichts gefunden.</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.bg {
		position: fixed;
		inset: 0;
		z-index: 160;
		background: rgb(5 9 26 / 0.55);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}

	.palette {
		position: fixed;
		left: 50%;
		top: 12vh;
		z-index: 161;
		translate: -50% 0;
		width: min(38rem, calc(100vw - 1.5rem));
		border: 1px solid transparent;
		border-radius: 20px;
		background:
			linear-gradient(rgb(13 21 52 / 0.94), rgb(13 21 52 / 0.94)) padding-box,
			linear-gradient(140deg, rgb(94 234 212 / 0.45), rgb(143 155 255 / 0.15) 45%, rgb(244 114 182 / 0.4)) border-box;
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		box-shadow:
			0 40px 100px -30px rgb(0 0 0 / 0.9),
			0 0 80px -30px rgb(143 155 255 / 0.5);
		overflow: hidden;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.9rem 1.1rem;
		border-bottom: 1px solid var(--line-soft);
		color: var(--dust);
	}

	.bar input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		font-size: 1.02rem;
		outline: none;
	}

	.results {
		max-height: 55vh;
		margin: 0;
		padding: 0.4rem;
		overflow-y: auto;
		list-style: none;
	}

	.results button {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		width: 100%;
		padding: 0.55rem 0.7rem;
		border: 0;
		border-radius: 12px;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.results button.active {
		background: linear-gradient(90deg, rgb(var(--accent-rgb) / 0.12), rgb(143 155 255 / 0.08));
	}

	.ico {
		display: grid;
		place-items: center;
		flex: none;
		width: 2rem;
		height: 2rem;
		border-radius: 9px;
		background: var(--nebula-soft);
		color: var(--nebula);
	}

	.ico.aktion {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.ico.kunde {
		background: rgb(var(--pink-rgb) / 0.12);
		color: var(--pink);
	}

	.txt {
		flex: 1;
		min-width: 0;
		display: grid;
		line-height: 1.3;
	}

	.txt strong {
		font-weight: 550;
		font-size: 0.92rem;
	}

	.txt small {
		color: var(--dust-2);
		font-size: 0.78rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.kind {
		color: var(--dust-2);
		font-size: 0.72rem;
	}

	.none {
		padding: 1.25rem;
		color: var(--dust);
		text-align: center;
	}
</style>
