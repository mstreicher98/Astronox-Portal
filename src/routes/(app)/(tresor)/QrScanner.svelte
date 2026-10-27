<script lang="ts">
	import { Camera, ImageUp } from '@lucide/svelte';
	import { tick } from 'svelte';
	import type jsQRType from 'jsqr';

	/**
	 * QR-Code lesen: mit der Kamera (Handy, Laptop) oder aus einem Bild – auswählen oder
	 * einen Screenshot mit Strg+V einfügen. jsQR wird erst beim ersten Lesen geladen.
	 */
	let { onresult }: { onresult: (text: string) => void } = $props();

	let status = $state<'bereit' | 'kamera' | 'keine-kamera' | 'nichts'>('bereit');
	let video = $state<HTMLVideoElement>();
	const hasCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

	let stream: MediaStream | null = null;
	let raf = 0;
	let decode: typeof jsQRType | null = null;
	let canvas: HTMLCanvasElement | null = null;

	const reader = async () => (decode ??= (await import('jsqr')).default);

	function read(source: CanvasImageSource, w: number, h: number): string | null {
		if (!decode || !w || !h) return null;
		// verkleinert geht es schneller und reicht für QR-Codes
		const scale = Math.min(1, 1200 / Math.max(w, h));
		canvas ??= document.createElement('canvas');
		canvas.width = Math.round(w * scale);
		canvas.height = Math.round(h * scale);
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return null;
		ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
		const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
		return decode(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || null;
	}

	async function startCamera() {
		try {
			await reader();
			stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
		} catch {
			status = 'keine-kamera';
			return;
		}
		status = 'kamera';
		await tick();
		if (!video) return stop();
		video.srcObject = stream;
		await video.play().catch(() => {});
		let last = 0;
		const loop = (t: number) => {
			raf = requestAnimationFrame(loop);
			if (t - last < 200 || !video || video.readyState < 2) return;
			last = t;
			const text = read(video, video.videoWidth, video.videoHeight);
			if (text) {
				stop();
				onresult(text);
			}
		};
		raf = requestAnimationFrame(loop);
	}

	function stop() {
		cancelAnimationFrame(raf);
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		if (status === 'kamera') status = 'bereit';
	}

	async function fromImage(file: Blob) {
		await reader();
		const bmp = await createImageBitmap(file).catch(() => null);
		const text = bmp && read(bmp, bmp.width, bmp.height);
		bmp?.close();
		if (text) onresult(text);
		else status = 'nichts';
	}

	function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) void fromImage(file);
	}

	// Screenshot einfügen – nur Bilder abfangen, Text wird normal eingefügt
	function onPaste(e: ClipboardEvent) {
		const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
		if (!file) return;
		e.preventDefault();
		void fromImage(file);
	}

	$effect(() => stop);
</script>

<svelte:window onpaste={onPaste} />

<div class="scanner">
	{#if status === 'kamera'}
		<div class="view">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={video} playsinline muted></video>
			<span class="frame" aria-hidden="true"></span>
		</div>
		<div class="spread">
			<p class="small muted">Halte den QR-Code in den Rahmen.</p>
			<button class="btn quiet sm" type="button" onclick={stop}>Abbrechen</button>
		</div>
	{:else}
		<div class="row wrap">
			{#if hasCamera}
				<button class="btn ghost sm" type="button" onclick={startCamera}><Camera size={15} /> Mit Kamera scannen</button>
			{/if}
			<label class="btn ghost sm">
				<ImageUp size={15} /> Bild wählen
				<input type="file" accept="image/*" hidden onchange={onFile} />
			</label>
		</div>
		<p class="small muted">Am Computer: Screenshot vom QR-Code machen und hier mit <kbd>Strg</kbd>+<kbd>V</kbd> einfügen.</p>
		{#if status === 'keine-kamera'}
			<p class="small hint" role="alert">Keine Kamera erreichbar – erlaube den Zugriff im Browser oder nimm ein Bild.</p>
		{:else if status === 'nichts'}
			<p class="small hint" role="alert">In dem Bild war kein QR-Code zu finden.</p>
		{/if}
	{/if}
</div>

<style>
	.scanner {
		display: grid;
		gap: 0.6rem;
		padding: 0.8rem 0.9rem;
		border: 1px dashed var(--line);
		border-radius: 10px;
	}

	.scanner p {
		margin: 0;
	}

	.view {
		position: relative;
		overflow: hidden;
		border-radius: 10px;
		background: var(--night);
		aspect-ratio: 4 / 3;
	}

	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.frame {
		position: absolute;
		inset: 15% 22%;
		border: 2px solid var(--accent);
		border-radius: 14px;
		box-shadow: 0 0 0 100vmax rgb(7 13 36 / 0.45);
	}

	.hint {
		color: var(--warn);
	}

	kbd {
		padding: 0 0.3rem;
		border: 1px solid var(--line);
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
</style>
