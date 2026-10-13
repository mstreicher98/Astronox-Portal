<script lang="ts">
	import { ImagePlus, Trash2 } from '@lucide/svelte';
	import { toast } from '$lib/ui/toast.svelte';

	/** Bild hochladen (wird auf dem Server zugeschnitten und als WebP gespeichert) */
	let { value = $bindable(''), purpose = 'referenz', label = 'Bild' }: { value: string; purpose?: 'referenz' | 'foto'; label?: string } = $props();
	let busy = $state(false);
	let input = $state<HTMLInputElement>();

	async function upload() {
		const file = input?.files?.[0];
		if (!file) return;
		busy = true;
		const fd = new FormData();
		fd.set('file', file);
		fd.set('purpose', purpose);
		try {
			const res = await fetch('/api/medien', { method: 'POST', body: fd });
			const body = await res.json();
			if (!res.ok) throw new Error(body.message);
			value = body.url;
			toast('Bild hochgeladen – Speichern nicht vergessen');
		} catch (err) {
			toast((err as Error).message || 'Hochladen fehlgeschlagen', 'error');
		} finally {
			busy = false;
			if (input) input.value = '';
		}
	}
</script>

<div class="field">
	<span>{label} <small>{purpose === 'foto' ? '(quadratisch, 800 × 800)' : '(16:10, wird zugeschnitten)'}</small></span>
	<div class="img" class:square={purpose === 'foto'} class:busy>
		{#if value}
			<img src={value} alt="" />
			<button class="btn quiet icon sm remove" type="button" aria-label="Bild entfernen" onclick={() => (value = '')}><Trash2 size={14} /></button>
		{/if}
		<label class="pick">
			<ImagePlus size={18} />
			<span>{value ? 'Ersetzen' : 'Bild wählen'}</span>
			<input bind:this={input} type="file" accept="image/*" class="sr-only" onchange={upload} />
		</label>
	</div>
</div>

<style>
	.img {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: 16 / 10;
		max-width: 22rem;
		border: 1.5px dashed var(--line);
		border-radius: 12px;
		overflow: hidden;
		background: rgb(7 13 36 / 0.45);
	}

	.img.square {
		aspect-ratio: 1;
		max-width: 12rem;
	}

	.img img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pick {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: rgb(11 19 48 / 0.8);
		color: var(--star);
		font-size: 0.82rem;
		cursor: pointer;
		backdrop-filter: blur(6px);
	}

	.pick:hover {
		background: var(--nebula-soft);
	}

	.remove {
		position: absolute;
		top: 0.4rem;
		right: 0.4rem;
		background: rgb(11 19 48 / 0.8);
	}

	.busy::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgb(143 155 255 / 0.25), transparent);
		background-size: 200% 100%;
		animation: shimmer 1.2s linear infinite;
	}
</style>
