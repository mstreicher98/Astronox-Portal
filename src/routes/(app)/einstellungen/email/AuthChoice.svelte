<script lang="ts">
	import type { MailAuth } from '$lib/shared/settings';

	/** Anmeldung beim Mailserver: klassisch oder über Microsoft 365 */
	let { value = $bindable() }: { value: MailAuth } = $props();
</script>

<div class="seg" role="radiogroup" aria-label="Anmeldung">
	<label class:on={value === 'passwort'}><input type="radio" name="auth" value="passwort" bind:group={value} /> Benutzer & Passwort</label>
	<label class:on={value === 'microsoft'}><input type="radio" name="auth" value="microsoft" bind:group={value} /> Microsoft 365</label>
</div>

<style>
	.seg {
		display: grid;
		grid-template-columns: 1fr 1fr;
		max-width: 26rem;
		padding: 0.25rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
	}

	.seg label {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 2.2rem;
		padding-inline: 0.75rem;
		border-radius: 999px;
		color: var(--dust);
		font-weight: 550;
		text-align: center;
		cursor: pointer;
		transition:
			background-color 0.25s,
			color 0.25s;
	}

	.seg label.on {
		background: var(--grad);
		color: var(--night);
	}

	.seg label:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.seg input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
