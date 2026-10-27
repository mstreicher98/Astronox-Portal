<script lang="ts">
	import { Eye, EyeOff, Plus, RefreshCw, ScanLine, Star, Trash2, WandSparkles, X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { parseMigration, parseOtp, type OtpImport } from '$lib/shared/otp';
	import { GEN_DEFAULTS, generatePassword, type GenOptions, type VaultEntry } from '$lib/shared/tresor';
	import { autosize } from '$lib/ui/actions';
	import type { EditMode } from '$lib/ui/tresor.svelte';
	import OtpCode from './OtpCode.svelte';
	import QrScanner from './QrScanner.svelte';
	import Strength from './Strength.svelte';

	/** Eingabe eines Tresor-Eintrags – gespeichert (und verschlüsselt) wird im Layout */
	let {
		entry,
		mode = 'passwort',
		categories,
		onsave,
		onimport,
		oncancel,
		ondelete
	}: {
		entry: VaultEntry;
		mode?: EditMode;
		categories: string[];
		onsave: (e: VaultEntry) => Promise<void>;
		/** Export aus Google Authenticator mit mehreren Konten */
		onimport: (list: OtpImport[]) => void;
		oncancel: () => void;
		ondelete?: () => void;
	} = $props();

	// eigene Kopie – erst „Speichern“ gibt sie zurück; mindestens ein Feld für den Link
	const start = untrack(() => structuredClone(entry));
	const konto = untrack(() => mode === 'konto');
	const e = $state<VaultEntry>({ ...start, urls: start.urls.length ? start.urls : [''] });
	let busy = $state(false);
	let show = $state(false);
	let gen = $state(false);
	let opts = $state<GenOptions>({ ...GEN_DEFAULTS });

	/* ---------- Authenticator */
	let otpInput = $state('');
	let otpError = $state('');
	let scanning = $state(konto && !start.otp);
	let showSecret = $state(false);

	/** Schlüssel, otpauth-Link oder Export – true, wenn etwas übernommen wurde */
	function useOtp(text: string): boolean {
		const many = parseMigration(text);
		if (many) {
			if (!many.length) otpError = 'In dem Export war kein zeitbasiertes Konto.';
			else if (many.length === 1) take(many[0]);
			else onimport(many);
			return many.length > 0;
		}
		const one = parseOtp(text);
		if (!one) {
			otpError = /^otpauth:\/\/hotp/i.test(text.trim())
				? 'Zählerbasierte Codes (HOTP) gehen hier nicht – nur zeitbasierte (TOTP).'
				: 'Das ist kein gültiger Schlüssel oder otpauth-Link.';
			return false;
		}
		take(one);
		return true;
	}

	function take(a: OtpImport) {
		e.otp = { secret: a.secret, algorithm: a.algorithm, digits: a.digits, period: a.period };
		if (!e.title.trim()) e.title = a.issuer || a.account;
		if (!e.username.trim() && a.issuer) e.username = a.account;
		otpInput = '';
		otpError = '';
		scanning = false;
	}

	// Links sind sofort vollständig – einfache Schlüssel erst beim Verlassen des Felds
	function onOtpInput() {
		otpError = '';
		if (/^otpauth(-migration)?:\/\//i.test(otpInput.trim())) useOtp(otpInput);
	}

	/* ---------- Passwort */
	function generate() {
		e.password = generatePassword(opts);
		show = true;
	}

	function openGenerator() {
		gen = !gen;
		if (gen) generate();
	}

	async function submit(ev: SubmitEvent) {
		ev.preventDefault();
		// eingefügter Schlüssel, aber noch nicht übernommen
		if (otpInput.trim() && !useOtp(otpInput)) return;
		busy = true;
		try {
			await onsave($state.snapshot(e));
		} finally {
			busy = false;
		}
	}
</script>

{#snippet authenticator()}
	<div class="field">
		<span>Authenticator <small>(2FA-Code)</small></span>
		{#if e.otp}
			<div class="otp-set">
				<OtpCode otp={e.otp} />
				<small class="muted">{e.otp.algorithm} · {e.otp.digits} Stellen · alle {e.otp.period} s</small>
				<span class="push"></span>
				<button class="btn quiet sm" type="button" onclick={() => (showSecret = !showSecret)}>{showSecret ? 'Schlüssel verbergen' : 'Schlüssel'}</button>
				<button class="btn quiet icon sm" type="button" aria-label="Authenticator entfernen" title="Entfernen" onclick={() => (e.otp = null)}><X size={15} /></button>
			</div>
			{#if showSecret}<code class="mono secret" transition:slide={{ duration: 180 }}>{e.otp.secret.replace(/(.{4})/g, '$1 ').trim()}</code>{/if}
		{:else}
			<div class="line">
				<input
					class="mono"
					bind:value={otpInput}
					oninput={onOtpInput}
					onchange={() => otpInput.trim() && useOtp(otpInput)}
					autocomplete="off"
					spellcheck="false"
					placeholder="Schlüssel oder otpauth://-Link einfügen"
					aria-label="Schlüssel für den Authenticator"
					aria-invalid={!!otpError}
				/>
				<button class="btn ghost sm" class:active={scanning} type="button" onclick={() => (scanning = !scanning)}><ScanLine size={15} /> QR-Code</button>
			</div>
			{#if otpError}<small class="wrong" role="alert">{otpError}</small>{/if}
			{#if scanning}
				<div transition:slide={{ duration: 200 }}><QrScanner onresult={(t) => useOtp(t)} /></div>
			{/if}
		{/if}
	</div>
{/snippet}

{#snippet more()}
	<div class="field">
		<span>Passwort</span>
		<div class="pw">
			<input class="mono" type={show ? 'text' : 'password'} bind:value={e.password} autocomplete="new-password" spellcheck="false" aria-label="Passwort" />
			<button class="btn quiet icon sm" type="button" aria-label={show ? 'Verbergen' : 'Anzeigen'} onclick={() => (show = !show)}>
				{#if show}<EyeOff size={16} />{:else}<Eye size={16} />{/if}
			</button>
			<button class="btn ghost sm" class:active={gen} type="button" onclick={openGenerator}><WandSparkles size={15} /> Generieren</button>
		</div>
		<Strength password={e.password} />
		{#if gen}
			<div class="gen" transition:slide={{ duration: 200 }}>
				<label class="len">
					<span>Länge <strong class="num">{opts.length}</strong></span>
					<input type="range" min="8" max="64" bind:value={opts.length} oninput={generate} />
				</label>
				<div class="row wrap">
					<label class="check"><input type="checkbox" bind:checked={opts.lower} onchange={generate} /> abc</label>
					<label class="check"><input type="checkbox" bind:checked={opts.upper} onchange={generate} /> ABC</label>
					<label class="check"><input type="checkbox" bind:checked={opts.digits} onchange={generate} /> 123</label>
					<label class="check"><input type="checkbox" bind:checked={opts.symbols} onchange={generate} /> !#$</label>
					<button class="btn quiet sm" type="button" onclick={generate}><RefreshCw size={14} /> Neu</button>
				</div>
			</div>
		{/if}
	</div>

	{#if !konto}{@render authenticator()}{/if}

	<div class="field">
		<span>Links</span>
		{#each e.urls as _, i (i)}
			<div class="line">
				<input bind:value={e.urls[i]} inputmode="url" spellcheck="false" placeholder="https://…" aria-label="Link {i + 1}" />
				{#if e.urls.length > 1}
					<button class="btn quiet icon sm" type="button" aria-label="Link entfernen" onclick={() => e.urls.splice(i, 1)}><X size={15} /></button>
				{/if}
			</div>
		{/each}
		<button class="btn quiet sm add" type="button" onclick={() => e.urls.push('')}><Plus size={14} /> Link</button>
	</div>

	<div class="field">
		<span>Weitere Felder <small>(z. B. PIN, Kundennummer, Sicherheitsfrage)</small></span>
		{#each e.fields as f, i (i)}
			<div class="line" transition:slide={{ duration: 180 }}>
				<input class="label-in" bind:value={f.label} placeholder="Bezeichnung" aria-label="Bezeichnung" />
				<input class:mono={f.secret} type={f.secret ? 'password' : 'text'} bind:value={f.value} autocomplete="off" placeholder="Wert" aria-label="Wert" />
				<button class="btn quiet icon sm" type="button" aria-pressed={f.secret} title={f.secret ? 'Wird verdeckt angezeigt' : 'Verdeckt anzeigen'} onclick={() => (f.secret = !f.secret)}>
					{#if f.secret}<EyeOff size={15} />{:else}<Eye size={15} />{/if}
				</button>
				<button class="btn quiet icon sm" type="button" aria-label="Feld entfernen" onclick={() => e.fields.splice(i, 1)}><X size={15} /></button>
			</div>
		{/each}
		<button class="btn quiet sm add" type="button" onclick={() => e.fields.push({ label: '', value: '', secret: false })}><Plus size={14} /> Feld</button>
	</div>

	<label class="field">
		<span>Notizen</span>
		<textarea bind:value={e.notes} rows="3" use:autosize placeholder="z. B. Hinweise zur Zwei-Faktor-Anmeldung, Wiederherstellungscodes"></textarea>
	</label>
{/snippet}

<form class="stack" onsubmit={submit} autocomplete="off">
	<div class="title-row">
		<label class="field grow">
			<span>{konto ? 'Anbieter' : 'Titel'}</span>
			<input bind:value={e.title} required placeholder={konto ? 'z. B. Google, Microsoft, GitHub – kommt meist aus dem QR-Code' : 'z. B. Bank, Google, Hosting-Panel'} />
		</label>
		<button class="fav" class:on={e.favorite} type="button" aria-pressed={e.favorite} title="Favorit" onclick={() => (e.favorite = !e.favorite)}>
			<Star size={18} />
		</button>
	</div>

	{#if konto}{@render authenticator()}{/if}

	<div class="form-grid">
		<label class="field">
			<span>{konto ? 'Konto' : 'Benutzername / E-Mail'}</span>
			<input bind:value={e.username} autocomplete="off" spellcheck="false" />
		</label>
		<label class="field">
			<span>Kategorie <small>(optional)</small></span>
			<input bind:value={e.category} list="tresor-kategorien" placeholder="z. B. Privat, Bank, Arbeit" />
			<datalist id="tresor-kategorien">
				{#each categories as c (c)}<option value={c}></option>{/each}
			</datalist>
		</label>
	</div>

	{#if konto}
		<!-- beim Authenticator stehen Passwort & Co. hinten an -->
		<details class="more" open={!!(start.password || start.notes || start.fields.length || start.urls.some(Boolean))}>
			<summary>Passwort, Links und Notizen</summary>
			<div class="stack">{@render more()}</div>
		</details>
	{:else}
		{@render more()}
	{/if}

	<div class="form-actions">
		{#if ondelete}
			<button class="btn danger" type="button" onclick={ondelete}><Trash2 size={15} /> Löschen</button>
		{/if}
		<button class="btn ghost" type="button" onclick={oncancel}>Abbrechen</button>
		<button class="btn" class:busy type="submit" disabled={busy}>Speichern</button>
	</div>
</form>

<style>
	.title-row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.grow {
		flex: 1;
	}

	.fav {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.6rem;
		height: 2.6rem;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: transparent;
		color: var(--dust-2);
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}

	.fav:hover {
		color: var(--warn);
	}

	.fav.on {
		border-color: rgb(var(--warn-rgb) / 0.5);
		color: var(--warn);
	}

	.fav.on :global(svg) {
		fill: currentColor;
	}

	.pw,
	.line {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.pw input,
	.line input {
		flex: 1;
		min-width: 0;
	}

	.line .label-in {
		flex: 0 1 10rem;
	}

	.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.gen {
		display: grid;
		gap: 0.6rem;
		padding: 0.75rem 0.9rem;
		border: 1px dashed var(--line);
		border-radius: 10px;
	}

	.len {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: var(--dust);
	}

	/* ohne den Rahmen der Eingabefelder (.field input) */
	.gen .len input[type='range'] {
		width: 100%;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		box-shadow: none;
		accent-color: var(--accent);
	}

	.add {
		justify-self: start;
	}

	.otp-set {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.75rem;
		padding: 0.35rem 0.4rem 0.35rem 0.25rem;
		border: 1px solid rgb(var(--accent-rgb) / 0.3);
		border-radius: 10px;
		background: rgb(var(--accent-rgb) / 0.05);
	}

	.push {
		flex: 1;
	}

	.secret {
		color: var(--warn);
		word-break: break-all;
		font-size: 0.85rem;
	}

	.wrong {
		color: var(--danger);
	}

	.more {
		border-top: 1px solid var(--line-soft);
		padding-top: 0.75rem;
	}

	.more summary {
		color: var(--dust);
		font-size: 0.88rem;
		cursor: pointer;
	}

	.more[open] summary {
		margin-bottom: 0.9rem;
	}

	@media (max-width: 560px) {
		.pw {
			flex-wrap: wrap;
		}

		.pw input {
			flex-basis: calc(100% - 3rem);
		}
	}
</style>
