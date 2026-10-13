/** Kleine Svelte-Aktionen für Bewegung */

const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lichtschein am Kartenrand folgt dem Mauszeiger (Klasse .card.glow) */
export function glow(node: HTMLElement) {
	node.classList.add('glow');
	let raf = 0;
	const move = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return;
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(() => {
			const r = node.getBoundingClientRect();
			node.style.setProperty('--mx', `${e.clientX - r.left}px`);
			node.style.setProperty('--my', `${e.clientY - r.top}px`);
		});
	};
	node.addEventListener('pointermove', move, { passive: true });
	return {
		destroy() {
			cancelAnimationFrame(raf);
			node.removeEventListener('pointermove', move);
		}
	};
}

/** Leichtes Kippen zur Maus – für hervorgehobene Karten */
export function tilt(node: HTMLElement, max = 4) {
	if (still()) return {};
	const move = (e: PointerEvent) => {
		if (e.pointerType !== 'mouse') return;
		const r = node.getBoundingClientRect();
		const x = (e.clientX - r.left) / r.width - 0.5;
		const y = (e.clientY - r.top) / r.height - 0.5;
		node.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
	};
	const leave = () => (node.style.transform = '');
	node.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
	node.addEventListener('pointermove', move, { passive: true });
	node.addEventListener('pointerleave', leave);
	return {
		destroy() {
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerleave', leave);
		}
	};
}

/** Zahl zählt beim Erscheinen hoch; format formatiert den Zwischenwert */
export function countUp(node: HTMLElement, opts: { value: number; format?: (n: number) => string; duration?: number }) {
	let raf = 0;
	let shown = 0;
	const run = (o: typeof opts) => {
		const fmt = o.format ?? ((n: number) => String(Math.round(n)));
		cancelAnimationFrame(raf);
		if (still()) {
			node.textContent = fmt(o.value);
			shown = o.value;
			return;
		}
		const from = shown;
		const to = o.value;
		const dur = o.duration ?? 1100;
		const start = performance.now();
		const step = (t: number) => {
			const p = Math.min(1, (t - start) / dur);
			const eased = 1 - Math.pow(1 - p, 4);
			shown = from + (to - from) * eased;
			node.textContent = fmt(shown);
			if (p < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	};
	run(opts);
	return {
		update: run,
		destroy: () => cancelAnimationFrame(raf)
	};
}

/** Klick außerhalb schließt Menüs */
export function outside(node: HTMLElement, cb: () => void) {
	const handler = (e: PointerEvent) => {
		if (!node.contains(e.target as Node)) cb();
	};
	document.addEventListener('pointerdown', handler, true);
	return { destroy: () => document.removeEventListener('pointerdown', handler, true) };
}

/** Textfeld wächst mit dem Inhalt */
export function autosize(node: HTMLTextAreaElement) {
	const fit = () => {
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight + 2}px`;
	};
	node.addEventListener('input', fit);
	requestAnimationFrame(fit);
	return { destroy: () => node.removeEventListener('input', fit) };
}
