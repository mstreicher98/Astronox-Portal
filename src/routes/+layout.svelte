<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Overlays from '$lib/components/Overlays.svelte';
	import Starfield from '$lib/components/Starfield.svelte';

	let { children } = $props();
	// Anmeldung und Einrichtung: dichterer Himmel mit vielen Sternschnuppen
	const auth = $derived(['/anmelden', '/einrichten'].some((p) => page.url.pathname.startsWith(p)));

	// Weiche Seitenwechsel, wo der Browser View Transitions kann
	onNavigate((navigation) => {
		if (!document.startViewTransition || navigation.from?.url.pathname === navigation.to?.url.pathname) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<Starfield showers={auth} density={auth ? 1.7 : 1} />
{@render children()}
<Overlays />
