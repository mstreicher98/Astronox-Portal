<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, Copy, ShieldCheck } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import AuthFrame from '$lib/components/AuthFrame.svelte';
	import { toast } from '$lib/ui/toast.svelte';

	let { data, form } = $props();
	let busy = $state(false);

	async function copyCodes() {
		await navigator.clipboard.writeText((form?.codes ?? []).join('\n'));
		toast('Notfallcodes kopiert');
	}
</script>

<svelte:head><title>Zwei-Faktor – Astronox Portal</title></svelte:head>

{#if form?.codes}
	<AuthFrame title="Fertig – gut gesichert" lead="Bewahre diese Notfallcodes sicher auf (z. B. im Passwort-Manager). Jeder funktioniert einmal, falls das Handy weg ist." wide>
		<div in:fly={{ y: 16, duration: 450 }} class="stack">
			<ol class="codes">
				{#each form.codes as c, i (c)}<li class="mono" style="--i: {i}">{c}</li>{/each}
			</ol>
			<div class="row wrap">
				<button class="btn ghost" type="button" onclick={copyCodes}><Copy size={16} /> Kopieren</button>
				<a class="btn" href="/" data-sveltekit-reload>Zum Portal <ArrowRight size={16} /></a>
			</div>
		</div>
	</AuthFrame>
{:else}
	<AuthFrame title="Authenticator verbinden" lead="QR-Code mit Google Authenticator, Microsoft Authenticator, 1Password oder einer ähnlichen App scannen und den 6-stelligen Code eingeben." wide>
		<div class="pair">
			<div class="qr">{@html data.qr}</div>
			<div class="stack">
				<p class="small muted">Oder den Schlüssel von Hand eingeben:</p>
				<p class="secret mono">{data.secret}</p>
				<form
					method="POST"
					class="stack"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							busy = false;
							await update();
						};
					}}
				>
					<label class="field">
						<span>Code aus der App</span>
						<input class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required placeholder="123 456" />
					</label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button class="btn" class:busy type="submit"><ShieldCheck size={17} /> Bestätigen</button>
				</form>
			</div>
		</div>
	</AuthFrame>
{/if}

<style>
	.pair {
		display: grid;
		grid-template-columns: 11rem minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}

	.qr {
		padding: 0.5rem;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 0 50px -10px rgb(143 155 255 / 0.6);
	}

	.qr :global(svg) {
		width: 100%;
		height: auto;
	}

	.secret {
		padding: 0.55rem 0.7rem;
		border: 1px dashed var(--line);
		border-radius: 10px;
		color: var(--accent);
		word-break: break-all;
		font-size: 0.78rem;
	}

	.code {
		font-family: var(--font-mono);
		font-size: 1.2rem !important;
		letter-spacing: 0.25em;
		text-align: center;
	}

	.error {
		color: var(--danger);
		font-size: 0.9rem;
	}

	.codes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.codes li {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: rgb(7 13 36 / 0.6);
		text-align: center;
		animation: rise 0.5s var(--ease-out) both;
		animation-delay: calc(var(--i) * 60ms);
	}

	@media (max-width: 520px) {
		.pair {
			grid-template-columns: minmax(0, 1fr);
		}
		.qr {
			width: 12rem;
			justify-self: center;
		}
	}
</style>
