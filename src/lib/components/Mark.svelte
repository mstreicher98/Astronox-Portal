<script lang="ts">
	/** Bildmarke: vierstrahliger Stern mit geneigter Umlaufbahn und Planet */
	let { size = 32, title = '' }: { size?: number; title?: string } = $props();
	const uid = $props.id();
</script>

<svg class="mark" width={size} height={size} viewBox="0 0 48 48" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'} aria-label={title || undefined}>
	<defs>
		<linearGradient id="star-{uid}" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#5eead4" />
			<stop offset="0.52" stop-color="#8f9bff" />
			<stop offset="1" stop-color="#f472b6" />
		</linearGradient>
	</defs>
	<g transform="rotate(-24 24 24)" fill="none" stroke="var(--violet)" stroke-width="2.2" stroke-linecap="round">
		<!-- hinterer Teil der Bahn liegt hinter dem Stern -->
		<path d="M3 24 A21 7.5 0 0 1 45 24" opacity="0.55" />
	</g>
	<path
		fill="url(#star-{uid})"
		d="M24 4.5c1.3 11.2 5.6 16.2 19.5 19.5C29.6 27.3 25.3 32.3 24 43.5 22.7 32.3 18.4 27.3 4.5 24 18.4 20.7 22.7 15.7 24 4.5Z"
	/>
	<g transform="rotate(-24 24 24)">
		<path d="M45 24 A21 7.5 0 0 1 3 24" fill="none" stroke="var(--violet)" stroke-width="2.2" stroke-linecap="round" />
		<circle cx="38.85" cy="29.3" r="3.1" fill="var(--star)" stroke="var(--night)" stroke-width="1.6" />
	</g>
</svg>

<style>
	.mark {
		flex: none;
		overflow: visible;
		/* sonst schrumpft das Zeichen in Raster-Containern auf 0 */
		max-width: none;
	}
</style>
