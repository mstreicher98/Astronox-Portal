<script lang="ts">
	import { Eye, EyeOff, Plus, RefreshCw, Star, Trash2, WandSparkles, X } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { GEN_DEFAULTS, generatePassword, type GenOptions, type VaultEntry } from '$lib/shared/tresor';
	import { autosize } from '$lib/ui/actions';
	import Strength from './Strength.svelte';

	/** Eingabe eines Tresor-Eintrags – gespeichert (und verschlüsselt) wird in der Seite */
	let {
		entry,
		categories,
		onsave,
		oncancel,
		ondelete
	}: { entry: VaultEntry; categories: string[]; onsave: (e: VaultEntry) => Promise<void>; oncancel: () => void; ondelete?: () => void } = $props();

	// eigene Kopie – erst „Speichern“ gibt sie zurück; mindestens ein Feld für den Link
	const start = untrack(() => structuredClone(entry));
	const e = $state<VaultEntry>({ ...start, urls: start.urls.length ? start.urls : [''] });
	let busy = $state(false);
	let show = $state(false);
	let gen = $state(false);
	let opts = $state<GenOptions>({ ...GEN_DEFAULTS });

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
		busy = true;
		try {
			await onsave($state.snapshot(e));
		} finally {
			busy = false;
		}
	}
</script>

<form class="stack" onsubmit={submit} autocomplete="off">
	<div class="title-row">
		<label class="field grow">
			<span>Titel</span>
			<input bind:value={e.title} required placeholder="z. B. Bank, Google, Hosting-Panel" />
		</label>
		<button class="fav" class:on={e.favorite} type="button" aria-pressed={e.favorite} title="Favorit" onclick={() => (e.favorite = !e.favorite)}>
			<Star size={18} />
		</button>
	</div>

	<div class="form-grid">
		<label class="field">
			<span>Benutzername / E-Mail</span>
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

	.pw .active {
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

	@media (max-width: 560px) {
		.pw {
			flex-wrap: wrap;
		}

		.pw input {
			flex-basis: calc(100% - 3rem);
		}
	}
</style>
