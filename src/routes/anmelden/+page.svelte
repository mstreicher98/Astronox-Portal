<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, KeyRound, LogIn } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import AuthFrame from '$lib/components/AuthFrame.svelte';

	let { data, form: result } = $props();
	const form = $derived(result as { message?: string; step?: string; email?: string; restart?: boolean } | null);
	const step = $derived(form?.restart ? 'passwort' : (form?.step ?? data.step));
	let busy = $state(false);

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
</style>
