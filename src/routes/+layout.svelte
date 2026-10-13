<script lang="ts">
	import '../app.css';
	import { onNavigate } from '$app/navigation';
	import Overlays from '$lib/components/Overlays.svelte';
	import Starfield from '$lib/components/Starfield.svelte';

	let { children } = $props();

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

<Starfield />
{@render children()}
<Overlays />
