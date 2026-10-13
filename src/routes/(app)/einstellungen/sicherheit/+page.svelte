<script lang="ts">
	import { enhance } from '$app/forms';
	import { KeyRound, LifeBuoy, LogOut, Monitor, ShieldCheck, Smartphone, TriangleAlert, User } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { relative } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();
	let pairing = $state<{ qr: string; secret: string } | null>(null);
	let codes = $state<string[] | null>(null);

	const device = (ua: string | null) => (!ua ? 'Unbekannt' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : 'Gerät');
</script>

<svelte:head><title>Sicherheit – Einstellungen</title></svelte:head>

{#if data.notfall}
	<p class="notice warn"><TriangleAlert size={16} /> Du hast dich mit einem Notfallcode angemeldet. Verbinde unten eine neue Authenticator-App und erzeuge neue Notfallcodes.</p>
{/if}

<form method="POST" action="?/profil" class="card stack" use:glow use:enhance={submit()}>
	<h2><User size={17} /> Konto</h2>
	<div class="form-grid">
		<label class="field"><span>Name</span><input name="name" value={data.name} required /></label>
		<label class="field"><span>E-Mail (Anmeldung)</span><input name="email" type="email" value={data.email} required /></label>
	</div>
	<div class="form-actions"><button class="btn ghost sm" type="submit">Speichern</button></div>
</form>

<form method="POST" action="?/passwort" class="card stack" use:glow use:enhance={submit({ reset: true })}>
	<h2><KeyRound size={17} /> Passwort ändern</h2>
	<div class="form-grid-3">
		<label class="field"><span>Aktuelles Passwort</span><input name="current" type="password" autocomplete="current-password" required /></label>
		<label class="field"><span>Neues Passwort</span><input name="next" type="password" autocomplete="new-password" minlength="12" required /></label>
		<label class="field"><span>Wiederholen</span><input name="repeat" type="password" autocomplete="new-password" minlength="12" required /></label>
	</div>
	<div class="form-actions"><button class="btn ghost sm" type="submit">Ändern</button></div>
</form>

<div class="card stack" use:glow>
	<h2><Smartphone size={17} /> Authenticator-App</h2>
	<p class="small muted"><ShieldCheck size={14} /> Zwei-Faktor ist aktiv. Neues Handy? Hier eine neue App verbinden – die alte gilt danach nicht mehr.</p>
	{#if !pairing}
		<form
			method="POST"
			action="?/koppeln_start"
			class="row wrap"
			use:enhance={submit({
				done: (d) => {
					if (d?.qr) pairing = { qr: d.qr as string, secret: d.secret as string };
				}
			})}
		>
			<input class="input pw" name="current" type="password" placeholder="Passwort zur Bestätigung" autocomplete="current-password" required />
			<button class="btn ghost sm" type="submit">Neue App verbinden</button>
		</form>
	{:else}
		<div class="pair" transition:slide>
			<div class="qr">{@html pairing.qr}</div>
			<div class="stack">
				<p class="small muted">QR-Code scannen oder Schlüssel eingeben:</p>
				<code class="mono">{pairing.secret}</code>
				<form method="POST" action="?/koppeln" class="row" use:enhance={submit({ reset: true, done: (d) => d?.message && (pairing = null) })}>
					<input class="input code" name="code" inputmode="numeric" maxlength="7" placeholder="123 456" required />
					<button class="btn sm" type="submit">Bestätigen</button>
				</form>
			</div>
		</div>
	{/if}
</div>

<div class="card stack" use:glow>
	<h2><LifeBuoy size={17} /> Notfallcodes</h2>
	<p class="small muted">Noch <strong>{data.recoveryLeft}</strong> unbenutzte Codes. Neue Codes machen die alten ungültig.</p>
	{#if codes}
		<ol class="codes" transition:slide>{#each codes as c (c)}<li class="mono">{c}</li>{/each}</ol>
		<p class="small faint">Jetzt sicher aufbewahren – sie werden nicht noch einmal angezeigt.</p>
	{:else}
		<form method="POST" action="?/notfallcodes" class="row wrap" use:enhance={submit({ reset: true, done: (d) => d?.codes && (codes = d.codes as string[]) })}>
			<input class="input code" name="code" inputmode="numeric" maxlength="7" placeholder="Code aus der App" required />
			<button class="btn ghost sm" type="submit">Neue Codes erzeugen</button>
		</form>
	{/if}
</div>

<div class="card stack" use:glow>
	<div class="spread">
		<h2><Monitor size={17} /> Angemeldete Geräte</h2>
		{#if data.sessions.length > 1}
			<form method="POST" action="?/abmelden" use:enhance={submit()}><button class="btn quiet sm" type="submit"><LogOut size={14} /> Alle anderen abmelden</button></form>
		{/if}
	</div>
	<ul class="list">
		{#each data.sessions as s (s.id)}
			<li class="spread small" style="padding: 0.45rem 0">
				<span>{device(s.userAgent)} · angemeldet {relative(s.createdAt)}</span>
				{#if s.current}<span class="badge accent">dieses Gerät</span>{:else}<span class="faint">aktiv {relative(s.lastSeenAt)}</span>{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	p.small {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.pw {
		max-width: 18rem;
		min-height: 2.2rem;
	}

	.code {
		width: 9rem;
		min-height: 2.2rem;
		font-family: var(--font-mono);
		letter-spacing: 0.15em;
		text-align: center;
	}

	.pair {
		display: grid;
		grid-template-columns: 10rem minmax(0, 1fr);
		gap: 1rem;
	}

	.qr {
		padding: 0.4rem;
		border-radius: 12px;
		background: #fff;
	}

	.qr :global(svg) {
		width: 100%;
		height: auto;
	}

	code {
		color: var(--accent);
		word-break: break-all;
	}

	.codes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.codes li {
		padding: 0.4rem;
		border: 1px solid var(--line);
		border-radius: 8px;
		text-align: center;
	}
</style>
