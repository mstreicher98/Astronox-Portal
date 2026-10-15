<script lang="ts">
	/**
	 * Bildmarke: vierstrahliger Stern mit drei geneigten Umlaufbahnen in Sternenlicht
	 * und drei Planeten. Jede Bahn ist beim Planeten kräftig und läuft zur anderen
	 * Seite aus (abwechselnd links/rechts), die hinteren Hälften liegen hinter dem Stern.
	 * Gleiche Geometrie in scripts/icons.mjs (Favicons, Logo) und im PDF-Briefkopf.
	 */
	let { size = 32, title = '' }: { size?: number; title?: string } = $props();
	const uid = $props.id();
	/** side: auf welcher Seite die Bahn kräftig ist (-1 links, 1 rechts) */
	const ORBITS = [
		{ rx: 27.5, ry: 9.8, w: 1.1, side: -1 },
		{ rx: 21, ry: 7.5, w: 1.4, side: 1 },
		{ rx: 14.5, ry: 5.2, w: 1.2, side: -1 }
	];
</script>

<svg class="mark" width={size} height={size} viewBox="0 0 48 48" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title || undefined}>
	<defs>
		<linearGradient id="star-{uid}" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#5eead4" />
			<stop offset="0.52" stop-color="#8f9bff" />
			<stop offset="1" stop-color="#f472b6" />
		</linearGradient>
		{#each ORBITS as o, i (o.rx)}
			<linearGradient id="orbit{i}-{uid}" gradientUnits="userSpaceOnUse" x1={24 + o.side * o.rx} y1="24" x2={24 - o.side * o.rx} y2="24">
				<stop offset="0" stop-color="var(--star)" />
				<stop offset="0.5" stop-color="var(--star)" stop-opacity="0.55" />
				<stop offset="0.92" stop-color="var(--star)" stop-opacity="0" />
			</linearGradient>
		{/each}
	</defs>
	<g transform="rotate(-24 24 24)">
		<!-- hintere Bahnhälften und der äußere Planet liegen hinter dem Stern -->
		<g fill="none" stroke-linecap="round" opacity="0.4">
			{#each ORBITS as o, i (o.rx)}<path d="M{24 - o.rx} 24A{o.rx} {o.ry} 0 0 1 {24 + o.rx} 24" stroke="url(#orbit{i}-{uid})" stroke-width={o.w} />{/each}
		</g>
		<circle cx="-1.84" cy="20.65" r="2.4" fill="#f472b6" />
	</g>
	<path
		fill="url(#star-{uid})"
		d="M24 4.5c1.3 11.2 5.6 16.2 19.5 19.5C29.6 27.3 25.3 32.3 24 43.5 22.7 32.3 18.4 27.3 4.5 24 18.4 20.7 22.7 15.7 24 4.5Z"
	/>
	<g transform="rotate(-24 24 24)">
		<g fill="none" stroke-linecap="round" opacity="0.9">
			{#each ORBITS as o, i (o.rx)}<path d="M{24 + o.rx} 24A{o.rx} {o.ry} 0 0 1 {24 - o.rx} 24" stroke="url(#orbit{i}-{uid})" stroke-width={o.w} />{/each}
		</g>
		<circle cx="38.85" cy="29.3" r="3.1" fill="#b197fc" stroke="var(--night)" stroke-width="1.6" />
		<circle cx="16.75" cy="28.5" r="2" fill="#5eead4" stroke="var(--night)" stroke-width="1.2" />
	</g>
</svg>

<style>
	.mark {
		flex: none;
		/* Bahnen ragen etwas über das 48er-Raster hinaus */
		overflow: visible;
		/* sonst schrumpft das Zeichen in Raster-Containern auf 0 */
		max-width: none;
	}
</style>
