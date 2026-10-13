<script lang="ts">
	import { enhance } from '$app/forms';
	import { Rocket } from '@lucide/svelte';
	import AuthFrame from '$lib/components/AuthFrame.svelte';

	let { form: result } = $props();
	const form = $derived(result as { message?: string; name?: string; email?: string } | null);
	let busy = $state(false);
</script>

<svelte:head><title>Einrichten – Astronox Portal</title></svelte:head>

<AuthFrame title="Portal einrichten" lead="Einmalig: dein Konto anlegen. Danach verbindest du eine Authenticator-App." wide>
	<form
		method="POST"
		class="form-grid"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<label class="field full">
			<span>Einrichtungscode <small>– steht im Protokoll des Containers „portal“</small></span>
			<input name="code" required autocomplete="off" placeholder="XXXXX-XXXXX" class="mono" />
		</label>
		<label class="field">
			<span>Name</span>
			<input name="name" required autocomplete="name" value={form?.name ?? 'Matthias Streicher'} />
		</label>
		<label class="field">
			<span>E-Mail</span>
			<input name="email" type="email" required autocomplete="username" value={form?.email ?? 'office@astronox.dev'} />
		</label>
		<label class="field">
			<span>Passwort <small>– mind. 12 Zeichen</small></span>
			<input name="password" type="password" required minlength="12" autocomplete="new-password" />
		</label>
		<label class="field">
			<span>Passwort wiederholen</span>
			<input name="password2" type="password" required minlength="12" autocomplete="new-password" />
		</label>
		{#if form?.message}<p class="error full" role="alert">{form.message}</p>{/if}
		<button class="btn full" class:busy type="submit"><Rocket size={17} /> Konto anlegen</button>
	</form>
</AuthFrame>

<style>
	.error {
		color: var(--danger);
		font-size: 0.9rem;
	}

	.btn {
		--h: 2.85rem;
		margin-top: 0.3rem;
	}
</style>
