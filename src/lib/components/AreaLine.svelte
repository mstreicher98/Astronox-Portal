<script lang="ts">
	/**
	 * Linie mit leichter Fläche für eine Reihe über die Zeit (z. B. Besuche je Tag).
	 * 2 px Linie, Fläche mit 10 % Deckkraft, Endpunkt mit Ring, Fadenkreuz mit
	 * Wert beim Darüberfahren.
	 */
	let {
		data,
		height = 120,
		label,
		format = (n: number) => String(n),
		axis = true
	}: { data: { label: string; value: number }[]; height?: number; label: string; format?: (n: number) => string; axis?: boolean } = $props();

	let w = $state(400);
	let hover = $state<number | null>(null);
	const uid = $props.id();

	const pad = $derived({ top: 10, right: 10, bottom: axis ? 20 : 6, left: 6 });
	const max = $derived(Math.max(1, ...data.map((d) => d.value)));
	const x = (i: number) => pad.left + (data.length > 1 ? (i / (data.length - 1)) * (w - pad.left - pad.right) : 0);
	const y = (v: number) => pad.top + (1 - v / max) * (height - pad.top - pad.bottom);

	const line = $derived(data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' '));
	const area = $derived(data.length ? `${line} L${x(data.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z` : '');

	function move(e: PointerEvent) {
		const r = (e.currentTarget as SVGElement).getBoundingClientRect();
		const rel = (e.clientX - r.left - pad.left) / Math.max(1, w - pad.left - pad.right);
		hover = Math.max(0, Math.min(data.length - 1, Math.round(rel * (data.length - 1))));
	}
</script>

<div class="chart" bind:clientWidth={w}>
	<svg width={w} {height} role="img" aria-label={label} onpointermove={move} onpointerleave={() => (hover = null)}>
		<defs>
			<linearGradient id="fill-{uid}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#8f9bff" stop-opacity="0.22" />
				<stop offset="1" stop-color="#8f9bff" stop-opacity="0.02" />
			</linearGradient>
			<linearGradient id="stroke-{uid}" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0" stop-color="#5eead4" />
				<stop offset="0.6" stop-color="#8f9bff" />
				<stop offset="1" stop-color="#f472b6" />
			</linearGradient>
		</defs>
		<line x1={pad.left} x2={w - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} class="base" />
		{#if data.length > 1}
			<path d={area} fill="url(#fill-{uid})" class="area" />
			<path d={line} fill="none" stroke="url(#stroke-{uid})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="line" pathLength="1" />
			<circle cx={x(data.length - 1)} cy={y(data.at(-1)!.value)} r="4" class="end" />
		{/if}
		{#if axis && data.length > 1}
			<text x={pad.left} y={height - 4} class="tick">{data[0].label}</text>
			<text x={w - pad.right} y={height - 4} class="tick" text-anchor="end">{data.at(-1)!.label}</text>
		{/if}
		{#if hover !== null}
			<line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={height - pad.bottom} class="cross" />
			<circle cx={x(hover)} cy={y(data[hover].value)} r="4" class="end" />
		{/if}
	</svg>
	{#if hover !== null}
		<div class="tip" style:left="{x(hover)}px" style:top="{y(data[hover].value) - 10}px">
			<span>{data[hover].label}</span>
			<strong>{format(data[hover].value)}</strong>
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
		touch-action: pan-y;
	}

	.base {
		stroke: rgb(39 50 95 / 0.55);
	}

	.line {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 1.6s var(--ease-out) forwards;
	}

	.area {
		animation: fade-in 1.2s 0.3s var(--ease-out) both;
	}

	.end {
		fill: var(--pink);
		stroke: var(--night-2);
		stroke-width: 2;
	}

	.cross {
		stroke: var(--dust-2);
		stroke-width: 1;
	}

	.tick {
		fill: var(--dust-2);
		font-size: 11px;
	}

	.tip {
		position: absolute;
		translate: -50% -100%;
		display: grid;
		justify-items: center;
		padding: 0.3rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--glass-strong);
		font-size: 0.76rem;
		white-space: nowrap;
		pointer-events: none;
	}

	.tip span {
		color: var(--dust);
	}

	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
</style>
