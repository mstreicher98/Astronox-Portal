<script lang="ts">
	import type { Snippet } from 'svelte';
	import Mark from './Mark.svelte';

	/** Rahmen für Anmeldung und Einrichtung: Orbit-System mit Planeten um die Karte */
	let { title, lead = '', wide = false, children }: { title: string; lead?: string; wide?: boolean; children: Snippet } = $props();
</script>

<main class="auth">
	<div class="system" aria-hidden="true">
		<span class="ring a"><i></i></span>
		<span class="ring b"><i></i></span>
		<span class="ring c"><i></i></span>
	</div>

	<section class="card" class:wide>
		<div class="brand">
			<span class="mark"><Mark size={46} /></span>
			<div>
				<p class="word">Astronox</p>
				<p class="sub">Portal</p>
			</div>
		</div>
		<h1>{title}</h1>
		{#if lead}<p class="lead">{lead}</p>{/if}
		<div class="content">{@render children()}</div>
	</section>
</main>

<style>
	.auth {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 100svh;
		padding: 2rem 1rem;
		overflow: hidden;
	}

	/* Drei geneigte Bahnen hinter der Karte */
	.system {
		position: absolute;
		left: 50%;
		top: 50%;
		width: min(150vmin, 1200px);
		aspect-ratio: 1;
		/* Verschiebung bewusst in transform: Lightning CSS verwirft beim Bauen ein separates translate neben festen transform-Werten */
		transform: translate(-50%, -50%) rotateX(68deg) rotateZ(-18deg);
		transform-style: preserve-3d;
		pointer-events: none;
	}

	.ring {
		position: absolute;
		border-radius: 50%;
		border: 1px solid rgb(143 155 255 / 0.22);
		animation: spin linear infinite;
	}

	.ring.a {
		inset: 30%;
		border-color: rgb(94 234 212 / 0.28);
		animation-duration: 26s;
	}

	.ring.b {
		inset: 17%;
		animation-duration: 44s;
		animation-direction: reverse;
	}

	.ring.c {
		inset: 3%;
		border-color: rgb(244 114 182 / 0.16);
		animation-duration: 70s;
	}

	.ring i {
		position: absolute;
		top: 50%;
		left: -7px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 22px 4px rgb(94 234 212 / 0.55);
	}

	.ring.b i {
		left: auto;
		right: -6px;
		width: 11px;
		height: 11px;
		background: var(--nebula);
		box-shadow: 0 0 22px 4px rgb(143 155 255 / 0.55);
	}

	.ring.c i {
		top: -8px;
		left: 50%;
		width: 16px;
		height: 16px;
		background: var(--pink);
		box-shadow: 0 0 26px 6px rgb(244 114 182 / 0.45);
	}

	.card {
		position: relative;
		width: min(25rem, 100%);
		padding: 2rem 1.75rem 1.75rem;
		border-radius: 24px;
		background: rgb(13 21 52 / 0.72);
		border: 1px solid transparent;
		background:
			linear-gradient(rgb(13 21 52 / 0.82), rgb(13 21 52 / 0.82)) padding-box,
			linear-gradient(140deg, rgb(94 234 212 / 0.5), rgb(143 155 255 / 0.2) 45%, rgb(244 114 182 / 0.45)) border-box;
		backdrop-filter: blur(22px) saturate(1.2);
		-webkit-backdrop-filter: blur(22px) saturate(1.2);
		box-shadow:
			0 40px 100px -30px rgb(0 0 0 / 0.85),
			0 0 120px -40px rgb(143 155 255 / 0.5);
		animation: arrive 0.9s var(--ease-out) both;
	}

	.card.wide {
		width: min(32rem, 100%);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.6rem;
	}

	.mark {
		display: grid;
		filter: drop-shadow(0 0 14px rgb(143 155 255 / 0.55));
		animation: float 6s ease-in-out infinite;
	}

	.word {
		font-family: var(--font-display);
		font-weight: 760;
		font-stretch: 140%;
		font-size: 1.3rem;
		line-height: 1;
		letter-spacing: 0.02em;
	}

	.sub {
		margin-top: 0.2rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.32em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h1 {
		font-size: 1.45rem;
	}

	.lead {
		margin-top: 0.4rem;
		color: var(--dust);
		font-size: 0.92rem;
	}

	.content {
		margin-top: 1.4rem;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@keyframes arrive {
		from {
			opacity: 0;
			translate: 0 24px;
			scale: 0.97;
			filter: blur(6px);
		}
	}

	@keyframes float {
		50% {
			translate: 0 -4px;
			rotate: 6deg;
		}
	}
</style>
