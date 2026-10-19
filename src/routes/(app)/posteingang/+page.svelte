<script lang="ts">
	import { MailOpen } from '@lucide/svelte';

	/** Lesebereich ohne ausgewählte Mail – am Handy ausgeblendet, dort zählt die Liste */
	let { data } = $props();
</script>

<svelte:head><title>Posteingang – Astronox Portal</title></svelte:head>

<div class="pick">
	<span class="orb"><MailOpen size={30} /></span>
	<p>Wähle eine Mail aus, um sie zu lesen.</p>
	{#if data.counts.unread}<p class="small muted">{data.counts.unread} ungelesen im Posteingang</p>{/if}
</div>

<style>
	.pick {
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.6rem;
		height: 100%;
		min-height: 20rem;
		padding: 2rem;
		color: var(--dust);
		text-align: center;
	}

	.orb {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		margin-bottom: 0.4rem;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, rgb(var(--accent-rgb) / 0.22), var(--nebula-soft) 70%);
		color: var(--accent);
		box-shadow: 0 0 40px -8px rgb(var(--accent-rgb) / 0.45);
	}

	p {
		margin: 0;
	}
</style>
