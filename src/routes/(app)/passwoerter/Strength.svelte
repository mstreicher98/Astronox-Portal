<script lang="ts">
	import { STRENGTH, strength } from '$lib/shared/tresor';

	/** Balken mit grober Stärke des Passworts */
	let { password }: { password: string } = $props();
	const s = $derived(strength(password));
	const tones = ['var(--danger)', 'var(--warn)', 'var(--sky)', 'var(--ok)'];
</script>

{#if password}
	<div class="strength" style:--c={tones[s.level]} aria-live="polite">
		<span class="bar">{#each [0, 1, 2, 3] as i (i)}<i class:on={i <= s.level}></i>{/each}</span>
		<small>{STRENGTH[s.level]} · etwa {s.bits} Bit</small>
	</div>
{/if}

<style>
	.strength {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.bar {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 3px;
		flex: 1;
		max-width: 9rem;
	}

	i {
		height: 4px;
		border-radius: 2px;
		background: var(--night-4);
		transition: background-color 0.25s;
	}

	i.on {
		background: var(--c);
	}

	small {
		color: var(--dust-2);
		font-size: 0.76rem;
	}
</style>
