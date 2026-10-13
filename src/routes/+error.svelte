<script lang="ts">
	import { page } from '$app/state';
	import Orbit from '$lib/components/Orbit.svelte';
</script>

<svelte:head><title>{page.status === 404 ? 'Nicht gefunden' : 'Fehler'} – Astronox Portal</title></svelte:head>

<main class="lost">
	<Orbit size={140} />
	<p class="code mono">{page.status}</p>
	<h1>{page.status === 404 ? 'Aus der Umlaufbahn geraten.' : 'Hier ist etwas schiefgelaufen.'}</h1>
	<p class="muted">{page.error?.message}</p>
	<a class="btn" href="/">Zum Cockpit</a>
</main>

<style>
	.lost {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 0.9rem;
		min-height: 80svh;
		padding: 2rem 1rem;
		text-align: center;
		animation: page-in 0.6s var(--ease-out) both;
	}

	.code {
		color: var(--accent);
		letter-spacing: 0.3em;
	}
</style>
