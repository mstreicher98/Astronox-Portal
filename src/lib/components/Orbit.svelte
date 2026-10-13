<script lang="ts">
	/** Ladeanimation und Schmuck: Stern mit zwei Umlaufbahnen und Planeten */
	let { size = 120, label = '' }: { size?: number; label?: string } = $props();
	const uid = $props.id();
</script>

<div class="orbit" style:--s="{size}px" role={label ? 'status' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'}>
	<span class="ring r1"><i></i></span>
	<span class="ring r2"><i></i></span>
	<svg class="star" viewBox="0 0 48 48">
		<defs>
			<linearGradient id="o-{uid}" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stop-color="#5eead4" />
				<stop offset="0.52" stop-color="#8f9bff" />
				<stop offset="1" stop-color="#f472b6" />
			</linearGradient>
		</defs>
		<path fill="url(#o-{uid})" d="M24 4.5c1.3 11.2 5.6 16.2 19.5 19.5C29.6 27.3 25.3 32.3 24 43.5 22.7 32.3 18.4 27.3 4.5 24 18.4 20.7 22.7 15.7 24 4.5Z" />
	</svg>
</div>

<style>
	.orbit {
		position: relative;
		width: var(--s);
		height: var(--s);
		flex: none;
	}

	.star {
		position: absolute;
		inset: 32%;
		width: 36%;
		height: 36%;
		filter: drop-shadow(0 0 calc(var(--s) * 0.08) rgb(143 155 255 / 0.7));
		animation: breathe 3.2s ease-in-out infinite;
	}

	.ring {
		position: absolute;
		border: 1px solid rgb(143 155 255 / 0.35);
		border-radius: 50%;
		animation: spin linear infinite;
	}

	.r1 {
		inset: 14%;
		animation-duration: 3.6s;
		transform: rotateX(62deg) rotateZ(0deg);
	}

	.r2 {
		inset: 0;
		border-color: rgb(94 234 212 / 0.25);
		animation-duration: 7s;
		animation-direction: reverse;
	}

	.ring i {
		position: absolute;
		top: -4px;
		left: calc(50% - 4px);
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--pink);
		box-shadow: 0 0 12px rgb(244 114 182 / 0.9);
	}

	.r2 i {
		background: var(--accent);
		box-shadow: 0 0 12px rgb(94 234 212 / 0.9);
		width: 6px;
		height: 6px;
		top: -3px;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@keyframes breathe {
		50% {
			scale: 1.12;
			filter: drop-shadow(0 0 calc(var(--s) * 0.14) rgb(244 114 182 / 0.6));
		}
	}
</style>
