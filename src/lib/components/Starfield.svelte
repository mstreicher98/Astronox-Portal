<script lang="ts">
	/**
	 * Sternenhimmel hinter dem ganzen Portal: Sterne in drei Tiefen, die der Maus
	 * leicht folgen, langsam ziehende Nebel und Sternschnuppen – im Portal selten,
	 * mit `showers` (Anmeldung) alle paar Sekunden, bis zu drei gleichzeitig.
	 * Läuft mit etwa 30 Bildern pro Sekunde (flüssig, solange eine Sternschnuppe
	 * fliegt) und pausiert, wenn der Tab im Hintergrund ist. Bei „weniger
	 * Bewegung“ wird einmal still gezeichnet.
	 */
	let { density = 1, showers = false }: { density?: number; showers?: boolean } = $props();
	let canvas: HTMLCanvasElement;

	interface Shooting {
		x: number;
		y: number;
		dx: number;
		dy: number;
		/** px/ms */
		speed: number;
		len: number;
		width: number;
		color: string;
		age: number;
		duration: number;
	}

	interface Star {
		x: number;
		y: number;
		r: number;
		a: number;
		depth: number;
		phase: number;
		speed: number;
		hue: string;
	}

	$effect(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const small = window.matchMedia('(max-width: 760px)').matches;
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		let w = 0;
		let h = 0;
		let stars: Star[] = [];
		let raf = 0;
		let last = 0;
		let px = 0;
		let py = 0;
		let tx = 0;
		let ty = 0;
		let shooting: Shooting[] = [];
		let nextShoot = performance.now() + (showers ? 700 : 4000) + Math.random() * (showers ? 1500 : 6000);
		let lastShoot = 0;
		/** Polarlicht, Nebel, Pulsar, Sternenlicht */
		const trails = ['200 245 238', '205 210 255', '252 200 225', '243 238 226'];

		const colors = ['243 238 226', '243 238 226', '243 238 226', '160 240 228', '190 198 255', '250 170 210'];
		const nebulae = [
			{ x: 0.82, y: 0.12, r: 0.42, c: '143 155 255', a: 0.07, sx: 0.00002, sy: 0.000013 },
			{ x: 0.08, y: 0.9, r: 0.38, c: '94 234 212', a: 0.05, sx: -0.000015, sy: 0.00001 },
			{ x: 0.55, y: 0.75, r: 0.32, c: '244 114 182', a: 0.045, sx: 0.000012, sy: -0.000016 }
		];

		function seed() {
			w = window.innerWidth;
			h = window.innerHeight;
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			const count = Math.min(small ? 90 : 190, Math.round(((w * h) / 7000) * density));
			stars = Array.from({ length: count }, () => {
				const depth = Math.random() ** 2;
				return {
					x: Math.random() * w,
					y: Math.random() * h,
					r: 0.3 + depth * 1.2,
					a: 0.3 + Math.random() * 0.55,
					depth,
					phase: Math.random() * Math.PI * 2,
					speed: 0.4 + Math.random() * 1.6,
					hue: colors[Math.floor(Math.random() * colors.length)]
				};
			});
		}

		function spawn() {
			const toRight = Math.random() < 0.5;
			const angle = ((14 + Math.random() * 26) * Math.PI) / 180;
			shooting.push({
				x: toRight ? Math.random() * w * 0.7 : w * (0.3 + Math.random() * 0.7),
				y: Math.random() * h * 0.55,
				dx: Math.cos(angle) * (toRight ? 1 : -1),
				dy: Math.sin(angle),
				speed: 0.55 + Math.random() * 0.6,
				len: 90 + Math.random() * 150,
				width: 1 + Math.random() * 0.9,
				color: trails[Math.floor(Math.random() * trails.length)],
				age: 0,
				duration: 650 + Math.random() * 800
			});
		}

		function drawShooting(dt: number) {
			for (const sh of shooting) {
				sh.age += dt;
				sh.x += sh.dx * sh.speed * dt;
				sh.y += sh.dy * sh.speed * dt;
				const p = sh.age / sh.duration;
				// schnell auf, langsam aus
				const alpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85);
				const len = sh.len * Math.min(1, p * 4);
				const tailX = sh.x - sh.dx * len;
				const tailY = sh.y - sh.dy * len;
				const g = ctx!.createLinearGradient(sh.x, sh.y, tailX, tailY);
				g.addColorStop(0, `rgb(${sh.color} / ${0.95 * alpha})`);
				g.addColorStop(0.25, `rgb(${sh.color} / ${0.45 * alpha})`);
				g.addColorStop(1, `rgb(${sh.color} / 0)`);
				ctx!.strokeStyle = g;
				ctx!.lineWidth = sh.width;
				ctx!.lineCap = 'round';
				ctx!.beginPath();
				ctx!.moveTo(sh.x, sh.y);
				ctx!.lineTo(tailX, tailY);
				ctx!.stroke();
				const head = ctx!.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, sh.width * 4);
				head.addColorStop(0, `rgb(255 255 255 / ${0.9 * alpha})`);
				head.addColorStop(1, `rgb(${sh.color} / 0)`);
				ctx!.fillStyle = head;
				ctx!.beginPath();
				ctx!.arc(sh.x, sh.y, sh.width * 4, 0, Math.PI * 2);
				ctx!.fill();
			}
			shooting = shooting.filter((sh) => sh.age < sh.duration && sh.x > -300 && sh.x < w + 300 && sh.y < h + 100);
		}

		function draw(t: number) {
			ctx!.clearRect(0, 0, w, h);
			px += (tx - px) * 0.05;
			py += (ty - py) * 0.05;

			// Nebel ziehen ganz langsam
			for (const n of nebulae) {
				const nx = (n.x + Math.sin(t * n.sx) * 0.06) * w;
				const ny = (n.y + Math.cos(t * n.sy) * 0.05) * h;
				const r = n.r * Math.max(w, h);
				const g = ctx!.createRadialGradient(nx, ny, 0, nx, ny, r);
				g.addColorStop(0, `rgb(${n.c} / ${n.a})`);
				g.addColorStop(1, `rgb(${n.c} / 0)`);
				ctx!.fillStyle = g;
				ctx!.fillRect(0, 0, w, h);
			}

			for (const s of stars) {
				const tw = still ? 1 : 0.72 + Math.sin(t * 0.001 * s.speed + s.phase) * 0.28;
				const shift = 4 + s.depth * 18;
				let x = s.x + px * shift;
				let y = s.y + py * shift - (still ? 0 : (t * 0.0012 * (0.2 + s.depth)) % h);
				if (y < 0) y += h;
				if (x < 0) x += w;
				else if (x > w) x -= w;
				ctx!.fillStyle = `rgb(${s.hue} / ${s.a * tw})`;
				ctx!.beginPath();
				ctx!.arc(x, y, s.r, 0, Math.PI * 2);
				ctx!.fill();
				if (s.r > 1.2) {
					ctx!.fillStyle = `rgb(${s.hue} / ${0.07 * tw})`;
					ctx!.beginPath();
					ctx!.arc(x, y, s.r * 3.4, 0, Math.PI * 2);
					ctx!.fill();
				}
			}
			if (still) return;

			// Anmeldung: alle 1,5–4,5 s, manchmal zwei kurz hintereinander · Portal: alle 9–21 s
			if (t > nextShoot && shooting.length < (showers ? 3 : 1)) {
				spawn();
				nextShoot = showers ? t + (Math.random() < 0.2 ? 250 + Math.random() * 400 : 1500 + Math.random() * 3000) : t + 9000 + Math.random() * 12000;
			}
			// nach einer Pause (Tab im Hintergrund) nicht springen
			const dt = lastShoot ? Math.min(50, t - lastShoot) : 16;
			lastShoot = t;
			drawShooting(dt);
		}

		function loop(t: number) {
			// etwa 30 Bilder pro Sekunde reichen für den Himmel und schonen den Akku – Sternschnuppen flüssig
			if (t - last > 32 || shooting.length) {
				draw(t);
				last = t;
			}
			raf = document.hidden ? 0 : requestAnimationFrame(loop);
			if (!raf) lastShoot = 0;
		}

		const start = () => {
			if (!still && !raf && !document.hidden) raf = requestAnimationFrame(loop);
		};

		seed();
		draw(performance.now());
		start();

		let resizeTimer: ReturnType<typeof setTimeout>;
		const onResize = () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				seed();
				draw(performance.now());
			}, 150);
		};
		const onMove = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return;
			tx = e.clientX / window.innerWidth - 0.5;
			ty = e.clientY / window.innerHeight - 0.5;
		};
		const onVis = () => start();
		window.addEventListener('resize', onResize, { passive: true });
		if (!still) window.addEventListener('pointermove', onMove, { passive: true });
		document.addEventListener('visibilitychange', onVis);

		return () => {
			cancelAnimationFrame(raf);
			clearTimeout(resizeTimer);
			window.removeEventListener('resize', onResize);
			window.removeEventListener('pointermove', onMove);
			document.removeEventListener('visibilitychange', onVis);
		};
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		z-index: -1;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
	}
</style>
