<script lang="ts">
	import { page } from '$app/state';
	import { Fingerprint, Info, Lock, Pencil, Plus, Search, ShieldCheck } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { initials } from '$lib/shared/format';
	import { avatarColor } from '$lib/shared/inbox';
	import { tresor, useVault } from '$lib/ui/tresor.svelte';
	import OtpCode from '../OtpCode.svelte';

	/** Laufende 2FA-Codes aller Tresor-Einträge mit Authenticator-Schlüssel */
	const vault = useVault();

	let q = $state('');
	const accounts = $derived(vault.items.filter((i) => i.otp && !i.broken));
	const shown = $derived(
		accounts
			.filter((i) => !q.trim() || `${i.title} ${i.username} ${i.category}`.toLowerCase().includes(q.toLowerCase().trim()))
			.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, 'de'))
	);

	// Aus der Befehlspalette: ?neu=1
	if (page.url.searchParams.has('neu')) untrack(() => vault.edit(null, 'konto'));
</script>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Authenticator</h1>
			<p class="lead">{accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'} · Klick auf einen Code kopiert ihn</p>
		</div>
		<div class="actions">
			<button class="btn quiet sm" type="button" onclick={vault.openBiometric}><Fingerprint size={15} /> Fingerabdruck</button>
			<button class="btn ghost sm" type="button" onclick={() => tresor.lock()}><Lock size={15} /> Sperren</button>
			<button class="btn" type="button" onclick={() => vault.edit(null, 'konto')}><Plus size={16} /> Konto</button>
		</div>
	</div>

	{#if accounts.length > 6}
		<label class="search">
			<Search size={16} />
			<input bind:value={q} placeholder="Anbieter oder Konto …" aria-label="Suchen" />
		</label>
	{/if}

	{#if !vault.ready}
		<div class="card empty"><p>Entschlüssle …</p></div>
	{:else if shown.length}
		<ul class="codes stagger">
			{#each shown as a, n (a.id)}
				<li class="card" style="--i: {n}">
					<div class="who">
						<span class="av" style:--c={avatarColor(a.title)}>{initials(a.title) || '?'}</span>
						<span class="txt">
							<strong>{a.title}</strong>
							{#if a.username}<small>{a.username}</small>{/if}
						</span>
						<button class="btn quiet icon sm" type="button" aria-label="Bearbeiten" title="Bearbeiten" onclick={() => vault.edit(a, 'konto')}><Pencil size={15} /></button>
					</div>
					<OtpCode otp={a.otp!} big />
				</li>
			{/each}
		</ul>
	{:else if accounts.length}
		<div class="card empty"><p>Nichts gefunden.</p></div>
	{:else}
		<div class="card empty">
			<ShieldCheck size={30} />
			<p>Noch keine Konten.<br />Aktivier bei einem Dienst die Zwei-Faktor-Anmeldung mit einer Authenticator-App und füg das Konto mit „Konto“ hinzu – per QR-Code oder Schlüssel.</p>
			<p class="small muted">Aus Google Authenticator kannst du alle Konten auf einmal übernehmen: dort „Konten übertragen“ → „Konten exportieren“ und den QR-Code scannen.</p>
		</div>
	{/if}

	<p class="notice small">
		<Info size={16} />
		<span>Den Code für die Anmeldung am Portal selbst hier nicht ablegen – zum Entsperren musst du schon angemeldet sein. Und für wichtige Konten zusätzlich die Wiederherstellungscodes des Dienstes aufheben.</span>
	</p>
</div>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 22rem;
		padding: 0 0.8rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: rgb(7 13 36 / 0.5);
		color: var(--dust-2);
	}

	.search input {
		flex: 1;
		min-width: 0;
		height: 2.3rem;
		border: 0;
		background: transparent;
		outline: none;
		font-size: 0.88rem;
	}

	.codes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16.5rem, 1fr));
		gap: 0.9rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.codes li {
		display: grid;
		gap: 0.6rem;
		padding: 0.9rem 0.9rem 0.7rem;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
	}

	.av {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 11px;
		background: color-mix(in srgb, var(--c) 16%, transparent);
		color: var(--c);
		font-size: 0.75rem;
		font-weight: 700;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 35%, transparent);
	}

	.txt {
		display: grid;
		flex: 1;
		min-width: 0;
		line-height: 1.3;
	}

	.txt strong {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.txt small {
		overflow: hidden;
		color: var(--dust-2);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.codes li :global(.otp) {
		justify-self: start;
	}

	.empty p {
		max-width: 34rem;
		margin: 0;
	}
</style>
