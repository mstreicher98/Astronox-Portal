<script module lang="ts">
	import type { StageId as Stage } from '$lib/shared/stages';

	export interface Card {
		id: number;
		title: string;
		stage: Stage;
		position: number;
		kind: string;
		valueCents: number | null;
		budgetLabel: string | null;
		dueDate: string | null;
		stageChangedAt: string;
		fromWebsite: boolean;
		customer: string;
		tasksOpen: number;
		tasksDone: number;
	}
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { CalendarClock, Globe, ListChecks } from '@lucide/svelte';
	import { flip } from 'svelte/animate';
	import { moneyShort, relative, today } from '$lib/shared/format';
	import { STAGES, kindLabel, type StageId } from '$lib/shared/stages';
	import { api } from '$lib/ui/form';
	import { onServerChange } from '$lib/ui/sync.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	/**
	 * Kanban-Board der Pipeline. Ziehen mit Maus sofort, am Handy nach kurzem
	 * Halten (damit das Wischen zum Scrollen frei bleibt). Die Karte fliegt mit
	 * leichter Neigung mit, die anderen Karten machen weich Platz.
	 */

	let { cards }: { cards: Card[] } = $props();

	const copy = () => cards.map((c) => ({ ...c }));
	let local = $state<Card[]>(copy());
	onServerChange(() => cards, () => (local = copy()));

	const columns = $derived(
		STAGES.map((s) => ({
			...s,
			cards: local.filter((c) => c.stage === s.id).sort((a, b) => a.position - b.position)
		}))
	);

	interface Drag {
		card: Card;
		from: StageId;
		x: number;
		y: number;
		dx: number;
		dy: number;
		w: number;
		h: number;
		over: StageId | null;
		index: number;
		tilt: number;
	}

	let drag = $state<Drag | null>(null);
	let pending: { card: Card; startX: number; startY: number; el: HTMLElement; pointer: PointerEvent; timer?: ReturnType<typeof setTimeout> } | null = null;
	let board = $state<HTMLElement>();
	let suppressClick = false;
	let scrollRaf = 0;
	let lastX = 0;

	function pointerDown(e: PointerEvent, card: Card) {
		if (e.button !== 0) return;
		const el = e.currentTarget as HTMLElement;
		pending = { card, startX: e.clientX, startY: e.clientY, el, pointer: e };
		// Touch: erst nach kurzem Halten ziehen
		if (e.pointerType !== 'mouse') {
			pending.timer = setTimeout(() => pending && begin(pending.pointer), 220);
		}
		window.addEventListener('pointermove', pointerMove, { passive: false });
		window.addEventListener('pointerup', pointerUp);
		window.addEventListener('pointercancel', cancel);
	}

	function begin(e: PointerEvent) {
		if (!pending) return;
		const r = pending.el.getBoundingClientRect();
		const index = columns.find((c) => c.id === pending!.card.stage)!.cards.findIndex((c) => c.id === pending!.card.id);
		drag = { card: pending.card, from: pending.card.stage, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, over: pending.card.stage, index, tilt: 0 };
		lastX = e.clientX;
		navigator.vibrate?.(8);
		document.body.style.userSelect = 'none';
		autoScroll();
	}

	function pointerMove(e: PointerEvent) {
		if (pending && !drag) {
			const moved = Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY);
			if (e.pointerType === 'mouse' && moved > 5) begin(e);
			else if (e.pointerType !== 'mouse' && moved > 10) {
				// Finger bewegt sich vor dem Halten: das ist Scrollen
				clearTimeout(pending.timer);
				cleanup();
			}
			if (pending) pending.pointer = e;
			return;
		}
		if (!drag) return;
		e.preventDefault();
		// Neigung folgt der Geschwindigkeit
		drag.tilt = Math.max(-8, Math.min(8, (e.clientX - lastX) * 0.6));
		lastX = e.clientX;
		drag.x = e.clientX;
		drag.y = e.clientY;
		locate(e.clientX, e.clientY);
	}

	function locate(x: number, y: number) {
		if (!drag) return;
		const col = document.elementsFromPoint(x, y).find((el) => el instanceof HTMLElement && el.dataset.stage) as HTMLElement | undefined;
		if (!col) return;
		const stage = col.dataset.stage as StageId;
		const items = [...col.querySelectorAll<HTMLElement>('[data-card]')].filter((el) => Number(el.dataset.card) !== drag!.card.id);
		let index = items.length;
		for (let i = 0; i < items.length; i++) {
			const r = items[i].getBoundingClientRect();
			if (y < r.top + r.height / 2) {
				index = i;
				break;
			}
		}
		drag.over = stage;
		drag.index = index;
	}

	/** Am Rand des Boards seitlich mitscrollen */
	function autoScroll() {
		cancelAnimationFrame(scrollRaf);
		const step = () => {
			if (!drag || !board) return;
			const r = board.getBoundingClientRect();
			const edge = 70;
			if (drag.x < r.left + edge) board.scrollLeft -= Math.ceil((r.left + edge - drag.x) / 6);
			else if (drag.x > r.right - edge) board.scrollLeft += Math.ceil((drag.x - (r.right - edge)) / 6);
			scrollRaf = requestAnimationFrame(step);
		};
		scrollRaf = requestAnimationFrame(step);
	}

	async function pointerUp() {
		if (pending?.timer) clearTimeout(pending.timer);
		const d = drag;
		cleanup();
		if (!d || !d.over) return;
		suppressClick = true;
		setTimeout(() => (suppressClick = false), 50);

		const target = columns.find((c) => c.id === d.over)!.cards.filter((c) => c.id !== d.card.id);
		const before = target[d.index - 1] ?? null;
		const after = target[d.index] ?? null;
		if (d.over === d.from && columns.find((c) => c.id === d.from)!.cards.findIndex((c) => c.id === d.card.id) === d.index) return;

		// sofort im Board zeigen, dann speichern
		const prev = local.map((c) => ({ ...c }));
		const card = local.find((c) => c.id === d.card.id)!;
		card.stage = d.over;
		card.position = before && after ? (before.position + after.position) / 2 : before ? before.position + 1 : after ? after.position - 1 : 0;
		card.stageChangedAt = d.over !== d.from ? new Date().toISOString() : card.stageChangedAt;
		try {
			await api('/api/pipeline', { id: card.id, stage: d.over, beforeId: before?.id ?? null, afterId: after?.id ?? null });
			if (d.over !== d.from) toast(`${card.title} → ${STAGES.find((s) => s.id === d.over)!.label}`);
		} catch {
			local = prev;
		}
	}

	function cancel() {
		if (pending?.timer) clearTimeout(pending.timer);
		cleanup();
	}

	function cleanup() {
		pending = null;
		drag = null;
		cancelAnimationFrame(scrollRaf);
		document.body.style.userSelect = '';
		window.removeEventListener('pointermove', pointerMove);
		window.removeEventListener('pointerup', pointerUp);
		window.removeEventListener('pointercancel', cancel);
	}

	function open(card: Card) {
		if (suppressClick) return;
		void goto(`/projekte/${card.id}`);
	}

	/** Tastatur: Karte mit Alt + Pfeil in die Nachbarspalte schieben */
	async function keyMove(e: KeyboardEvent, card: Card) {
		if (e.key === 'Enter') return open(card);
		if (!e.altKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
		e.preventDefault();
		const i = STAGES.findIndex((s) => s.id === card.stage) + (e.key === 'ArrowRight' ? 1 : -1);
		const stage = STAGES[i]?.id;
		if (!stage) return;
		card.stage = stage;
		await api('/api/pipeline', { id: card.id, stage });
		toast(`${card.title} → ${STAGES[i].label}`);
	}

	const sum = (list: Card[]) => list.reduce((s, c) => s + (c.valueCents ?? 0), 0);
	const day = today();
</script>

<div class="board" bind:this={board} class:dragging={!!drag}>
	{#each columns as col, ci (col.id)}
		{@const shown = drag ? col.cards.filter((c) => c.id !== drag!.card.id) : col.cards}
		{@const items = drag?.over === col.id ? [...shown.slice(0, drag.index), null, ...shown.slice(drag.index)] : shown}
		<section class="col" id={col.id} data-stage={col.id} style="--c: {col.color}; --ci: {ci}" class:over={drag?.over === col.id}>
			<header>
				<span class="dot"></span>
				<h2>{col.label}</h2>
				<span class="n">{col.cards.length}</span>
				{#if sum(col.cards)}<span class="sum num">{moneyShort(sum(col.cards))}</span>{/if}
			</header>
			<div class="cards">
				{#each items as card (card?.id ?? 'platz')}
					<div class="item" animate:flip={{ duration: 280 }}>
						{#if card}
							<div
								class="card-item"
								data-card={card.id}
								onpointerdown={(e) => pointerDown(e, card)}
								onclick={() => open(card)}
								onkeydown={(e) => keyMove(e, card)}
								tabindex="0"
								role="button"
								aria-label="{card.title}, {card.customer}. Alt + Pfeiltaste verschiebt die Karte."
							>
								{@render content(card)}
							</div>
						{:else}
							<div class="slot" style:height="{drag?.h ?? 80}px"></div>
						{/if}
					</div>
				{/each}
				{#if !col.cards.length && !(drag?.over === col.id)}
					<p class="hint">{col.hint}</p>
				{/if}
			</div>
		</section>
	{/each}
</div>

{#if drag}
	<div class="ghost" style:width="{drag.w}px" style:transform="translate({drag.x - drag.dx}px, {drag.y - drag.dy}px) rotate({drag.tilt}deg) scale(1.04)" style="--c: {STAGES.find((s) => s.id === drag!.over)?.color}">
		<div class="card-item lifted">{@render content(drag.card)}</div>
	</div>
{/if}

{#snippet content(card: Card)}
	<p class="customer">{card.customer}</p>
	<h3>{card.title}</h3>
	<div class="meta">
		<span class="chip">{kindLabel(card.kind)}</span>
		{#if card.valueCents}<span class="value num">{moneyShort(card.valueCents)}</span>{:else if card.budgetLabel}<span class="faint small">{card.budgetLabel}</span>{/if}
	</div>
	<footer>
		{#if card.fromWebsite}<span title="Über die Webseite"><Globe size={13} /></span>{/if}
		{#if card.tasksOpen + card.tasksDone}
			<span class="tasks" title="Aufgaben erledigt"><ListChecks size={13} /> {card.tasksDone}/{card.tasksOpen + card.tasksDone}</span>
		{/if}
		{#if card.dueDate}
			<span class:late={card.dueDate < day && card.stage !== 'abgeschlossen'} title="Fällig"><CalendarClock size={13} /> {relative(card.dueDate)}</span>
		{/if}
		<span class="age" title="Seit dem letzten Phasenwechsel">{relative(card.stageChangedAt)}</span>
	</footer>
{/snippet}

<style>
	.board {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(16.5rem, 1fr);
		gap: 0.85rem;
		min-height: calc(100svh - 12rem);
		padding: 0.25rem var(--gutter) 1.5rem;
		margin-inline: calc(var(--gutter) * -1);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		scrollbar-width: thin;
	}

	.col {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid var(--line-soft);
		border-radius: var(--radius-lg);
		background: linear-gradient(180deg, color-mix(in srgb, var(--c) 7%, rgb(13 21 52 / 0.55)), rgb(13 21 52 / 0.35) 40%);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		scroll-snap-align: start;
		transition:
			border-color 0.25s,
			box-shadow 0.25s,
			background-color 0.25s;
		animation: rise 0.55s var(--ease-out) both;
		animation-delay: calc(var(--ci) * 50ms);
	}

	.col.over {
		border-color: color-mix(in srgb, var(--c) 60%, transparent);
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent),
			0 0 40px -12px var(--c);
	}

	header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.85rem 0.9rem 0.6rem;
	}

	.dot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 10px var(--c);
	}

	h2 {
		font-size: 0.86rem;
		font-stretch: 112%;
	}

	.n {
		padding: 0 0.45rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.06);
		color: var(--dust);
		font-size: 0.72rem;
		line-height: 1.4rem;
	}

	.sum {
		margin-left: auto;
		color: var(--dust-2);
		font-size: 0.75rem;
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		flex: 1;
		padding: 0.15rem 0.6rem 0.8rem;
		min-height: 5rem;
	}

	.card-item {
		position: relative;
		display: grid;
		gap: 0.35rem;
		padding: 0.75rem 0.8rem 0.65rem;
		border: 1px solid var(--line-soft);
		border-radius: 14px;
		background: rgb(17 27 64 / 0.85);
		box-shadow: 0 8px 20px -14px rgb(0 0 0 / 0.8);
		cursor: grab;
		touch-action: pan-x pan-y;
		user-select: none;
		-webkit-user-select: none;
		transition:
			border-color 0.2s,
			transform 0.2s var(--ease-out),
			box-shadow 0.25s;
	}

	/* Farbkante der Phase */
	.card-item::before {
		content: '';
		position: absolute;
		left: -1px;
		top: 14px;
		bottom: 14px;
		width: 2px;
		border-radius: 2px;
		background: var(--c);
		opacity: 0.8;
	}

	.card-item:hover {
		border-color: var(--line);
		transform: translateY(-1px);
		box-shadow: 0 14px 30px -16px rgb(0 0 0 / 0.9);
	}

	.card-item:focus-visible {
		outline: 2px solid var(--c);
	}

	.dragging .card-item {
		cursor: grabbing;
	}

	.customer {
		color: var(--dust-2);
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	h3 {
		font-family: var(--font-body);
		font-weight: 600;
		font-stretch: 100%;
		font-size: 0.9rem;
		line-height: 1.3;
		letter-spacing: 0;
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 0.1rem;
	}

	.meta .chip {
		font-size: 0.7rem;
		padding: 0.05rem 0.5rem;
	}

	.value {
		font-weight: 600;
		font-size: 0.85rem;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		color: var(--dust-2);
		font-size: 0.72rem;
	}

	footer span {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.late {
		color: var(--danger);
	}

	.age {
		margin-left: auto;
	}

	.slot {
		border: 1.5px dashed color-mix(in srgb, var(--c) 55%, transparent);
		border-radius: 14px;
		background: color-mix(in srgb, var(--c) 8%, transparent);
		animation: open 0.2s var(--ease-out);
	}

	.hint {
		padding: 0.75rem 0.5rem;
		color: var(--dust-2);
		font-size: 0.78rem;
		text-align: center;
	}

	.ghost {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 300;
		pointer-events: none;
		transition: transform 0.06s linear;
	}

	.lifted {
		border-color: color-mix(in srgb, var(--c) 70%, transparent);
		box-shadow:
			0 30px 60px -20px rgb(0 0 0 / 0.9),
			0 0 40px -10px var(--c);
		background: rgb(22 33 76 / 0.96);
	}

	@keyframes open {
		from {
			height: 0;
			opacity: 0;
		}
	}
</style>
