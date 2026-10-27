<script lang="ts">
	import { untrack } from 'svelte';
	import { groupCode, otpCode, secondsLeft, type Otp } from '$lib/shared/otp';
	import { toast } from '$lib/ui/toast.svelte';

	/** Laufender Einmalcode; der Ring zeigt die restliche Zeit. Klick kopiert. */
	let { otp, big = false }: { otp: Otp; big?: boolean } = $props();

	let now = $state(Date.now());
	let code = $state('');

	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const counter = $derived(Math.floor(now / 1000 / otp.period));
	const left = $derived(secondsLeft(otp, now));

	// neuer Code, sobald das Zeitfenster wechselt
	$effect(() => {
		void counter;
		const o = otp;
		let alive = true;
		otpCode(o, untrack(() => now))
			.then((c) => alive && (code = c))
			.catch(() => alive && (code = ''));
		return () => {
			alive = false;
		};
	});

	const R = 9;
	const C = 2 * Math.PI * R;

	async function copy() {
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code);
			toast(left <= 5 ? `Code kopiert – nur noch ${left} s gültig` : 'Code kopiert');
		} catch {
			toast('Kopieren hat nicht geklappt.', 'error');
		}
	}
</script>

<button class="otp" class:big class:soon={left <= 5} type="button" onclick={copy} title="Code kopieren">
	<span class="code mono" aria-label="Code {code}">{code ? groupCode(code) : '··· ···'}</span>
	<svg class="ring" viewBox="0 0 24 24" aria-hidden="true">
		<circle class="track" cx="12" cy="12" r={R} />
		<circle class="left" class:jump={left === otp.period} cx="12" cy="12" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - left / otp.period)} />
	</svg>
	<span class="sr-only">noch {left} Sekunden gültig</span>
</button>

<style>
	.otp {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.2rem 0.45rem;
		border: 1px solid transparent;
		border-radius: 9px;
		background: none;
		color: var(--accent);
		cursor: copy;
		transition:
			border-color 0.2s,
			background-color 0.2s;
	}

	.otp:hover {
		border-color: var(--line);
		background: rgb(var(--accent-rgb) / 0.06);
	}

	.code {
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		white-space: nowrap;
		transition: color 0.3s;
	}

	.big {
		gap: 0.75rem;
		padding: 0.3rem 0.6rem 0.3rem 0.5rem;
	}

	.big .code {
		font-size: 1.7rem;
		letter-spacing: 0.08em;
	}

	.soon {
		color: var(--warn);
	}

	.ring {
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		rotate: -90deg;
	}

	.big .ring {
		width: 1.5rem;
		height: 1.5rem;
	}

	circle {
		fill: none;
		stroke-width: 3;
	}

	.track {
		stroke: var(--night-4);
	}

	.left {
		stroke: currentColor;
		stroke-linecap: round;
		transition: stroke-dashoffset 1s linear;
	}

	/* neues Zeitfenster: Ring springt ohne Animation zurück */
	.left.jump {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.left {
			transition: none;
		}
	}
</style>
