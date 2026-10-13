<script lang="ts">
	import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet } from '@lucide/svelte';

	/**
	 * Vorschau der Webseite mit Entwürfen – in Handy-, Tablet- oder
	 * Desktop-Breite, verkleinert auf die verfügbare Fläche.
	 */
	let { src, version = 0 }: { src: string; version?: number } = $props();

	const devices = [
		{ id: 'handy', label: 'Handy', w: 390, h: 844, icon: Smartphone },
		{ id: 'tablet', label: 'Tablet', w: 820, h: 1180, icon: Tablet },
		{ id: 'desktop', label: 'Desktop', w: 1366, h: 900, icon: Monitor }
	] as const;
	let device = $state<(typeof devices)[number]['id']>('desktop');
	let box = $state(600);
	let reload = $state(0);
	let loading = $state(true);

	const d = $derived(devices.find((x) => x.id === device)!);
	const scale = $derived(Math.min(1, box / d.w));

	$effect(() => {
		void version;
		void reload;
		loading = true;
	});
</script>

<div class="preview">
	<div class="bar">
		<div class="seg" role="radiogroup" aria-label="Gerät">
			{#each devices as x (x.id)}
				<button type="button" class:on={device === x.id} onclick={() => (device = x.id)} aria-label={x.label} title={x.label}><x.icon size={15} /></button>
			{/each}
		</div>
		<span class="small faint">Vorschau mit Entwürfen</span>
		<div class="row">
			<button class="btn quiet icon sm" type="button" aria-label="Neu laden" onclick={() => reload++}><RefreshCw size={14} /></button>
			<a class="btn quiet icon sm" href={src} target="_blank" rel="noopener" aria-label="In neuem Tab"><ExternalLink size={14} /></a>
		</div>
	</div>
	<div class="stage" bind:clientWidth={box} style:height="{d.h * scale}px">
		{#key `${version}-${reload}-${device}`}
			<div class="device {device}" style:width="{d.w}px" style:height="{d.h}px" style:transform="scale({scale})">
				<iframe title="Vorschau der Webseite" {src} onload={() => (loading = false)}></iframe>
			</div>
		{/key}
		{#if loading}<div class="loading"><span></span></div>{/if}
	</div>
</div>

<style>
	.preview {
		display: grid;
		gap: 0.6rem;
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.seg {
		display: inline-flex;
		padding: 0.15rem;
		border: 1px solid var(--line);
		border-radius: 999px;
	}

	.seg button {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 1.7rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--dust);
		cursor: pointer;
	}

	.seg button.on {
		background: var(--nebula-soft);
		color: var(--star);
	}

	.stage {
		position: relative;
		overflow: hidden;
		transition: height 0.45s var(--ease-out);
	}

	.device {
		transform-origin: top left;
		border: 1px solid var(--line);
		border-radius: 14px;
		overflow: hidden;
		background: #0b1330;
		box-shadow: 0 30px 70px -30px rgb(0 0 0 / 0.9);
		animation: in 0.45s var(--ease-out);
	}

	.device.handy {
		border-radius: 36px;
		border-width: 8px;
		border-color: #1b2552;
	}

	iframe {
		width: 100%;
		height: 100%;
		border: 0;
	}

	.loading {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.loading span {
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--nebula);
		border-color: var(--nebula) transparent var(--accent) transparent;
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}

	@keyframes in {
		from {
			opacity: 0;
			scale: 0.98;
		}
	}
</style>
