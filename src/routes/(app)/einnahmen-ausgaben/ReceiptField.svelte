<script lang="ts">
	import { Camera, FileCheck2, X } from '@lucide/svelte';

	/** Beleg als Foto (am Handy direkt mit der Kamera) oder PDF; zeigt einen vorhandenen Beleg an */
	let { href = null }: { href?: string | null } = $props();
	let picked = $state('');
	let remove = $state(false);
</script>

<div class="receipt full">
	<label class="pick" class:has={picked}>
		<input
			type="file"
			name="receipt"
			accept="image/*,application/pdf"
			class="sr-only"
			onchange={(e) => {
				picked = (e.currentTarget as HTMLInputElement).files?.[0]?.name ?? '';
				if (picked) remove = false;
			}}
		/>
		{#if picked}<FileCheck2 size={17} /> {picked}{:else}<Camera size={17} /> {href ? 'Beleg ersetzen' : 'Beleg fotografieren oder hochladen'}{/if}
	</label>
	{#if href && !picked}
		<a class="small" href={href} target="_blank" rel="noopener">Beleg ansehen</a>
		<label class="small check" class:off={remove}>
			<input type="checkbox" name="removeReceipt" bind:checked={remove} />
			<X size={13} /> entfernen
		</label>
	{/if}
</div>

<style>
	.receipt {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1rem;
	}

	.pick {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.65rem 1rem;
		border: 1px dashed var(--line);
		border-radius: 12px;
		color: var(--dust);
		font-size: 0.88rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			color 0.2s,
			background-color 0.2s;
	}

	.pick:hover,
	.pick:focus-within {
		border-color: var(--accent);
		color: var(--star);
	}

	.pick.has {
		border-style: solid;
		border-color: rgb(var(--ok-rgb) / 0.5);
		background: rgb(var(--ok-rgb) / 0.08);
		color: var(--star);
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--dust-2);
		cursor: pointer;
	}

	.check.off {
		color: var(--danger);
	}
</style>
