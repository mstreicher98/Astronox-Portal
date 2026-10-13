<script lang="ts">
	/**
	 * Säulendiagramm für eine Reihe (z. B. Umsatz je Monat). Säulen höchstens
	 * 24 px breit, oben gerundet, unten gerade; die hervorgehobene Säule (aktueller
	 * Monat) im Akzent. Hover zeigt den Wert, eine Tabelle steht für Screenreader bereit.
	 */
	let {
		data,
		format = (n: number) => String(n),
		highlight = -1,
		height = 180,
		label,
		minMax = 1,
		emptyText = 'Noch keine Werte'
	}: {
		data: { label: string; short: string; value: number }[];
		format?: (n: number) => string;
		highlight?: number;
		height?: number;
		label: string;
		/** kleinster Höchstwert der Achse, damit leere Diagramme sinnvolle Stufen zeigen */
		minMax?: number;
		emptyText?: string;
	} = $props();

	let w = $state(600);
	let hover = $state<number | null>(null);

	const pad = { top: 18, right: 8, bottom: 26, left: 52 };
	const empty = $derived(data.every((d) => !d.value));
	const max = $derived(Math.max(minMax, ...data.map((d) => d.value)));

	/** Saubere Achsenwerte: 1, 2 oder 5 × 10^n */
	const ticks = $derived.by(() => {
		const raw = max / 3;
		const mag = 10 ** Math.floor(Math.log10(raw || 1));
		const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
		const top = Math.ceil(max / step) * step;
		return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
	});
	const top = $derived(ticks.at(-1) || 1);
	const innerW = $derived(Math.max(10, w - pad.left - pad.right));
	const innerH = $derived(height - pad.top - pad.bottom);
	const band = $derived(innerW / Math.max(1, data.length));
	const barW = $derived(Math.min(24, band * 0.6));
	const y = (v: number) => pad.top + innerH - (v / top) * innerH;

	/** Säule mit 4 px Rundung oben, gerade an der Grundlinie */
	function bar(i: number, v: number) {
		const x = pad.left + i * band + (band - barW) / 2;
		const h = Math.max(0, (v / top) * innerH);
		const r = Math.min(4, barW / 2, h);
		const y0 = pad.top + innerH;
		const y1 = y0 - h;
		return `M${x},${y0} L${x},${y1 + r} Q${x},${y1} ${x + r},${y1} L${x + barW - r},${y1} Q${x + barW},${y1} ${x + barW},${y1 + r} L${x + barW},${y0} Z`;
	}
</script>

<div class="chart" bind:clientWidth={w}>
	<svg width={w} {height} role="img" aria-label={label}>
		{#each ticks as t (t)}
			<line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} class="grid" />
			<text x={pad.left - 8} y={y(t)} class="tick" text-anchor="end" dominant-baseline="middle">{format(t)}</text>
		{/each}
		{#each data as d, i (d.label)}
			<g class="col" style="--i: {i}">
				<path d={bar(i, d.value)} class:hi={i === highlight} class:dim={hover !== null && hover !== i} />
				<text x={pad.left + i * band + band / 2} y={height - 8} class="tick" text-anchor="middle">{d.short}</text>
				<!-- Trefferfläche: ganze Spalte -->
				<rect
					x={pad.left + i * band}
					y={pad.top}
					width={band}
					height={innerH}
					fill="transparent"
					role="presentation"
					onpointerenter={() => (hover = i)}
					onpointerleave={() => (hover = null)}
				/>
			</g>
		{/each}
	</svg>
	{#if empty}<p class="empty-note">{emptyText}</p>{/if}
	{#if hover !== null}
		{@const d = data[hover]}
		<div class="tip" style:left="{pad.left + hover * band + band / 2}px" style:top="{y(d.value) - 8}px">
			<span>{d.label}</span>
			<strong>{format(d.value)}</strong>
		</div>
	{/if}
	<table class="sr-only">
		<caption>{label}</caption>
		<tbody>
			{#each data as d (d.label)}<tr><th>{d.label}</th><td>{format(d.value)}</td></tr>{/each}
		</tbody>
	</table>
</div>

<style>
	.chart {
		position: relative;
		width: 100%;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.grid {
		stroke: rgb(39 50 95 / 0.55);
		stroke-width: 1;
	}

	.tick {
		fill: var(--dust-2);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	path {
		fill: rgb(143 155 255 / 0.75);
		transform-origin: center bottom;
		transform-box: fill-box;
		animation: up 0.9s var(--ease-out) both;
		animation-delay: calc(var(--i) * 40ms);
		transition:
			fill 0.2s,
			opacity 0.2s;
	}

	path.hi {
		fill: var(--accent);
	}

	path.dim {
		opacity: 0.45;
	}

	.tip {
		position: absolute;
		translate: -50% -100%;
		display: grid;
		justify-items: center;
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--glass-strong);
		box-shadow: 0 10px 30px -10px rgb(0 0 0 / 0.7);
		font-size: 0.78rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.tip span {
		color: var(--dust);
	}

	.empty-note {
		position: absolute;
		left: 52px;
		right: 0;
		top: 40%;
		color: var(--dust-2);
		font-size: 0.85rem;
		text-align: center;
	}

	@keyframes up {
		from {
			transform: scaleY(0);
		}
	}
</style>
