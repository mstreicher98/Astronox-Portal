<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { ArrowLeft, Fingerprint, KeyRound, LogIn } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import AuthFrame from '$lib/components/AuthFrame.svelte';
	import { cancelled, loginWithPasskey, passkeysSupported } from '$lib/ui/passkey';
	import { toast } from '$lib/ui/toast.svelte';

	let { data, form: result } = $props();
	const form = $derived(result as { message?: string; step?: string; email?: string; restart?: boolean } | null);
	const step = $derived(form?.restart ? 'passwort' : (form?.step ?? data.step));
	let busy = $state(false);

	/* ---------- Fingerabdruck oder Gesicht */
	let canPasskey = $state(false);
	let pkBusy = $state(false);
	onMount(() => (canPasskey = passkeysSupported()));

	async function passkey() {
		pkBusy = true;
		try {
			// ganz neu laden – das Portal startet mit der frischen Sitzung
			location.href = await loginWithPasskey(page.url.searchParams.get('ziel'));
		} catch (e) {
			if (!cancelled(e) && e instanceof Error && e.name !== 'Error') toast('Mit Fingerabdruck hat es nicht geklappt – bitte mit Passwort anmelden.', 'error');
			pkBusy = false;
		}
	}

	const done =
		() =>
		async ({ update }: { update: () => Promise<void> }) => {
			busy = false;
			await update();
		};
</script>

<svelte:head><title>Anmelden – Astronox Portal</title></svelte:head>

<AuthFrame title={step === 'code' ? 'Bestätigen' : 'Willkommen zurück'} lead={step === 'code' ? 'Code aus der Authenticator-App oder einen Notfallcode eingeben.' : 'Schön, dass du da bist. Bitte anmelden.'}>
	{#key step}
		<div in:fly={{ x: step === 'code' ? 30 : -30, duration: 420 }}>
			{#if step === 'passwort'}
				<form method="POST" action="?/passwort" use:enhance={() => ((busy = true), done())} class="stack">
					<label class="field">
						<span>E-Mail</span>
						<input name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />
					</label>
					<label class="field">
						<span>Passwort</span>
						<input name="password" type="password" autocomplete="current-password" required />
					</label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button class="btn" class:busy type="submit"><LogIn size={17} /> Weiter</button>
				</form>
				{#if canPasskey}
					<div class="or"><span>oder</span></div>
					<button class="btn ghost" class:busy={pkBusy} type="button" disabled={pkBusy} onclick={passkey}><Fingerprint size={18} /> Mit Fingerabdruck oder Gesicht</button>
				{/if}
			{:else}
				<form method="POST" action="?/code" use:enhance={() => ((busy = true), done())} class="stack">
					<label class="field">
						<span>Code</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="11" required autofocus placeholder="123 456" />
					</label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button class="btn" class:busy type="submit"><KeyRound size={17} /> Anmelden</button>
				</form>
				<form method="POST" action="?/zurueck" use:enhance>
					<button class="btn quiet sm back" type="submit"><ArrowLeft size={15} /> Anderes Konto</button>
				</form>
			{/if}
		</div>
	{/key}
</AuthFrame>

<style>
	.stack {
		gap: 1rem;
	}

	.code {
		font-family: var(--font-mono);
		font-size: 1.35rem !important;
		letter-spacing: 0.3em;
		text-align: center;
	}

	.error {
		color: var(--danger);
		font-size: 0.9rem;
	}

	.btn {
		width: 100%;
		--h: 2.85rem;
	}

	.back {
		margin-top: 0.6rem;
		width: auto;
	}

	.or {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1.1rem 0 0.9rem;
		color: var(--dust-2);
		font-size: 0.8rem;
	}

	.or::before,
	.or::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--line-soft);
	}
</style>
