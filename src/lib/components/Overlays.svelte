<script lang="ts">
	import { CircleAlert, CircleCheck, Info, X } from '@lucide/svelte';
	import { fly, scale, fade } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { answer, question } from '$lib/ui/confirm.svelte';
	import { dismiss, toasts } from '$lib/ui/toast.svelte';

	/** Hinweise und Rückfrage-Dialog – einmal im Layout eingebunden */
	let confirmBtn = $state<HTMLButtonElement>();

	$effect(() => {
		if (question.current) setTimeout(() => confirmBtn?.focus(), 30);
	});

	function onKey(e: KeyboardEvent) {
		if (!question.current) return;
		if (e.key === 'Escape') answer(false);
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="toasts" aria-live="polite">
	{#each toasts as t (t.id)}
		<div class="toast {t.kind}" in:fly={{ x: 40, duration: 380 }} out:fade={{ duration: 180 }} animate:flip={{ duration: 300 }}>
			{#if t.kind === 'ok'}<CircleCheck size={18} />{:else if t.kind === 'error'}<CircleAlert size={18} />{:else}<Info size={18} />{/if}
			<span>{t.text}</span>
			<button type="button" aria-label="Schließen" onclick={() => dismiss(t.id)}><X size={15} /></button>
		</div>
	{/each}
</div>

{#if question.current}
	<div class="backdrop" transition:fade={{ duration: 160 }} onclick={() => answer(false)} role="presentation"></div>
	<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="frage" transition:scale={{ start: 0.94, duration: 220 }}>
		<h2 id="frage">{question.current.text}</h2>
		{#if question.current.detail}<p class="muted">{question.current.detail}</p>{/if}
		<div class="row">
			<button class="btn ghost" type="button" onclick={() => answer(false)}>Abbrechen</button>
			<button class="btn {question.current.danger ? 'danger' : ''}" type="button" bind:this={confirmBtn} onclick={() => answer(true)}>{question.current.confirm}</button>
		</div>
	</div>
{/if}

<style>
	.toasts {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 200;
		display: grid;
		gap: 0.5rem;
		width: min(24rem, calc(100vw - 2rem));
	}

	.toast {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.6rem 0.7rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--glass-strong);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 18px 40px -16px rgb(0 0 0 / 0.7);
		font-size: 0.9rem;
	}

	.toast span {
		flex: 1;
	}

	.toast.ok :global(svg:first-child) {
		color: var(--ok);
	}

	.toast.error {
		border-color: rgb(var(--danger-rgb) / 0.45);
	}

	.toast.error :global(svg:first-child) {
		color: var(--danger);
	}

	.toast.info :global(svg:first-child) {
		color: var(--sky);
	}

	.toast button {
		display: grid;
		place-items: center;
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--dust-2);
		cursor: pointer;
	}

	.toast button:hover {
		color: var(--star);
		background: rgb(255 255 255 / 0.06);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgb(5 9 26 / 0.6);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.dialog {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 151;
		translate: -50% -50%;
		display: grid;
		gap: 0.8rem;
		width: min(26rem, calc(100vw - 2rem));
		padding: 1.4rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		background: var(--glass-strong);
		backdrop-filter: blur(18px);
		-webkit-backdrop-filter: blur(18px);
		box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.8);
	}

	.dialog .row {
		justify-content: flex-end;
		margin-top: 0.4rem;
	}

	@media (max-width: 760px) {
		.toasts {
			bottom: 5.5rem;
		}
	}
</style>
