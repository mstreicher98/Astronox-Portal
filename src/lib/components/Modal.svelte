<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	/** Dialog, auf dem Handy als Blatt von unten */
	let { open = $bindable(false), title, wide = false, children }: { open: boolean; title: string; wide?: boolean; children: Snippet } = $props();

	let box = $state<HTMLElement>();

	$effect(() => {
		if (!open) return;
		const prev = document.activeElement as HTMLElement | null;
		setTimeout(() => box?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, button.btn')?.focus(), 60);
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (open = false);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('keydown', onKey);
			prev?.focus?.();
		};
	});
</script>

{#if open}
	<div class="backdrop" transition:fade={{ duration: 180 }} onclick={() => (open = false)} role="presentation"></div>
	<div class="modal" class:wide role="dialog" aria-modal="true" aria-label={title} bind:this={box} in:fly={{ y: 24, duration: 360 }} out:fly={{ y: 16, duration: 180 }}>
		<header>
			<h2>{title}</h2>
			<button class="btn quiet icon sm" type="button" aria-label="Schließen" onclick={() => (open = false)}><X size={18} /></button>
		</header>
		<div class="body">
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 120;
		background: rgb(5 9 26 / 0.62);
		backdrop-filter: blur(5px);
		-webkit-backdrop-filter: blur(5px);
	}

	.modal {
		position: fixed;
		left: 50%;
		top: 8vh;
		z-index: 121;
		translate: -50% 0;
		display: flex;
		flex-direction: column;
		width: min(34rem, calc(100vw - 2rem));
		max-height: 84vh;
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		background: var(--glass-strong);
		backdrop-filter: blur(20px) saturate(1.2);
		-webkit-backdrop-filter: blur(20px) saturate(1.2);
		box-shadow:
			0 40px 90px -30px rgb(0 0 0 / 0.85),
			0 0 0 1px rgb(143 155 255 / 0.06);
	}

	.modal.wide {
		width: min(52rem, calc(100vw - 2rem));
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1rem 0.5rem 1.35rem;
	}

	.body {
		padding: 0.5rem 1.35rem 1.35rem;
		overflow-y: auto;
	}

	@media (max-width: 640px) {
		.modal,
		.modal.wide {
			top: auto;
			bottom: 0;
			width: 100vw;
			max-height: 92vh;
			border-radius: 22px 22px 0 0;
			padding-bottom: env(safe-area-inset-bottom);
		}
	}
</style>
