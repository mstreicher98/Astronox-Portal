<script lang="ts">
	import { enhance } from '$app/forms';
	import { Rocket, Save, Undo2 } from '@lucide/svelte';
	import ImageField from '$lib/components/ImageField.svelte';
	import ItemList from '$lib/components/ItemList.svelte';
	import SitePreview from '$lib/components/SitePreview.svelte';
	import { relative } from '$lib/shared/format';
	import { markdown } from '$lib/shared/markdown';
	import type { Package, Reference, Service, SiteContent } from '$lib/shared/site';
	import { autosize, glow } from '$lib/ui/actions';
	import { submit } from '$lib/ui/form';

	let { data } = $props();

	// Bearbeitete Fassung – eine tiefe Kopie, damit „Verwerfen“ einfach neu lädt
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fresh = (): any => structuredClone(data.value);
	let v = $state(fresh());
	// nach Speichern/Verwerfen neu übernehmen
	$effect(() => {
		v = fresh();
	});
	let version = $state(0);
	const dirty = $derived(JSON.stringify(v) !== JSON.stringify(data.value));
	const json = $derived(JSON.stringify(v));

	/** Mehrzeiliges Feld ↔ Liste */
	const lines = (arr: string[] | undefined) => (arr ?? []).join('\n');
	const toLines = (s: string) =>
		s
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
	const paras = (arr: string[] | undefined) => (arr ?? []).join('\n\n');
	const toParas = (s: string) =>
		s
			.split(/\n\s*\n/)
			.map((l) => l.trim())
			.filter(Boolean);

	const k = $derived(data.key as keyof SiteContent);
	const isLegal = $derived(k === 'impressum' || k === 'datenschutz');
	const done = () => version++;
</script>

<svelte:head><title>{data.info.label} – Webseite</title></svelte:head>

<div class="page">
	<div class="page-head">
		<div>
			<div class="crumbs"><a href="/webseite">Webseite</a> / {data.info.label}</div>
			<h1>{data.info.label}</h1>
			<p class="lead">
				{#if data.hasDraft}<span class="badge warn dot">Entwurf – noch nicht online</span>{:else}<span class="badge ok dot">Veröffentlicht {relative(data.publishedAt)}</span>{/if}
				{#if dirty}<span class="badge info">ungespeicherte Änderungen</span>{/if}
			</p>
		</div>
		<div class="actions">
			{#if data.hasDraft}
				<form method="POST" action="?/verwerfen" use:enhance={submit({ confirm: 'Entwurf verwerfen?', done })}><button class="btn quiet sm" type="submit"><Undo2 size={15} /> Verwerfen</button></form>
			{/if}
		</div>
	</div>

	<div class="layout" class:legal={isLegal}>
		<form method="POST" action="?/speichern" class="stack" use:enhance={submit({ done })}>
			<input type="hidden" name="value" value={json} />

			<div class="card stack" use:glow>
				{#if k === 'allgemein'}
					<div class="form-grid">
						<label class="field"><span>Name</span><input bind:value={v.name} /></label>
						<label class="field"><span>Inhaber</span><input bind:value={v.owner} /></label>
						<label class="field full"><span>E-Mail auf der Seite</span><input type="email" bind:value={v.email} /></label>
						<label class="field full"><span>Titel für Suchmaschinen und Browser-Tab</span><input bind:value={v.title} maxlength="70" /><small class="hint">{v.title?.length ?? 0} / 60 Zeichen empfohlen</small></label>
						<label class="field full"><span>Beschreibung für Suchmaschinen</span><textarea bind:value={v.description} rows="3" maxlength="200"></textarea><small class="hint">{v.description?.length ?? 0} / 155 Zeichen empfohlen</small></label>
					</div>
					<label class="switch"><input type="checkbox" bind:checked={v.inFounding} /> Unternehmen „in Gründung“ (Hinweis im Impressum und in der Fußzeile)</label>
				{:else if k === 'start' || k === 'kontakt'}
					<label class="field"><span>Überschrift</span><textarea bind:value={v.title} rows="2" use:autosize></textarea></label>
					<label class="field"><span>Text darunter</span><textarea bind:value={v.lead} rows="4" use:autosize></textarea></label>
					{#if k === 'start'}<p class="small faint">Tipp: „Web-Apps“ wird in der Überschrift nie getrennt.</p>{/if}
				{:else if isLegal}
					<label class="field">
						<span>Text in einfachem Markdown <small>– ## Überschrift, - Aufzählung, **fett**, [Link](https://…), ==noch offen==</small></span>
						<textarea class="mono-area" bind:value={v.markdown} rows="28"></textarea>
					</label>
				{:else}
					<label class="field"><span>Überschrift des Abschnitts</span><input bind:value={v.title} /></label>
					{#if 'text' in v}<label class="field"><span>Einleitung</span><textarea bind:value={v.text} rows="3" use:autosize></textarea></label>{/if}
				{/if}
			</div>

			{#if k === 'leistungen'}
				<div class="card stack" use:glow>
					<h2>Leistungen</h2>
					<p class="small faint">Die fünf Leistungen sind fest mit Orbit und Symbolen verbunden – Reihenfolge und Anzahl bleiben, die Texte sind frei.</p>
					<ItemList bind:items={v.items} fixed title={(s: Service) => s.name}>
						{#snippet item(s: Service)}
							<div class="form-grid">
								<label class="field"><span>Name</span><input bind:value={s.name} /></label>
								<label class="field"><span>Kurzname im Orbit</span><input bind:value={s.short} /></label>
								<label class="field full"><span>Text</span><textarea bind:value={s.text} rows="3" use:autosize></textarea></label>
								<label class="field full"><span>Beispiele <small>(eines pro Zeile)</small></span><textarea value={lines(s.examples)} oninput={(e) => (s.examples = toLines(e.currentTarget.value))} rows="3"></textarea></label>
							</div>
						{/snippet}
					</ItemList>
				</div>
			{:else if k === 'arbeitsweise'}
				<div class="card stack" use:glow>
					<h2>Grundsätze</h2>
					<ItemList bind:items={v.items} addLabel="Grundsatz" create={() => ({ title: '', text: '' })} title={(p: { title: string; text: string }) => p.title}>
						{#snippet item(p: { title: string; text: string })}
							<label class="field"><span>Titel</span><input bind:value={p.title} /></label>
							<label class="field"><span>Text</span><textarea bind:value={p.text} rows="2" use:autosize></textarea></label>
						{/snippet}
					</ItemList>
				</div>
			{:else if k === 'ablauf'}
				<div class="card stack" use:glow>
					<h2>Schritte</h2>
					<ItemList bind:items={v.items} addLabel="Schritt" create={() => ({ mark: 'T', title: '', text: '' })} title={(s: { mark: string; title: string; text: string }) => `${s.mark} · ${s.title}`}>
						{#snippet item(s: { mark: string; title: string; text: string })}
							<div class="form-grid">
								<label class="field"><span>Marke</span><input bind:value={s.mark} placeholder="T–4" /></label>
								<label class="field"><span>Titel</span><input bind:value={s.title} /></label>
								<label class="field full"><span>Text</span><textarea bind:value={s.text} rows="2" use:autosize></textarea></label>
							</div>
						{/snippet}
					</ItemList>
				</div>
			{:else if k === 'referenzen'}
				<div class="card stack" use:glow>
					<h2>Projekte</h2>
					<ItemList bind:items={v.items} addLabel="Referenz" create={(): Reference => ({ title: '', kind: 'Webseite', text: '', url: '', image: '', placeholder: false })} title={(r: Reference) => r.title}>
						{#snippet item(r: Reference)}
							<div class="form-grid">
								<label class="field"><span>Titel</span><input bind:value={r.title} /></label>
								<label class="field"><span>Art</span><input bind:value={r.kind} list="arten" /></label>
								<label class="field full"><span>Text</span><textarea bind:value={r.text} rows="2" use:autosize></textarea></label>
								<label class="field full"><span>Link <small>(optional)</small></span><input bind:value={r.url} placeholder="https://…" /></label>
							</div>
							<ImageField bind:value={r.image} label="Bildschirmfoto" />
							<label class="switch"><input type="checkbox" bind:checked={r.placeholder} /> Platzhalter (gestrichelt, „in Vorbereitung“)</label>
						{/snippet}
					</ItemList>
					<datalist id="arten"><option>Webseite</option><option>Web-App</option><option>Internes Tool</option><option>Webshop</option><option>Redesign</option></datalist>
				</div>
			{:else if k === 'pakete'}
				<div class="card stack" use:glow>
					<h2>Pakete</h2>
					<ItemList
						bind:items={v.items}
						addLabel="Paket"
						create={(): Package => ({ name: '', price: 'ab € ', for: '', features: [], highlight: false, cta: 'termin' })}
						title={(p: Package) => `${p.name} · ${p.price}`}
					>
						{#snippet item(p: Package)}
							<div class="form-grid">
								<label class="field"><span>Name</span><input bind:value={p.name} /></label>
								<label class="field"><span>Preis <small>(Text, z. B. „ab € 790“)</small></span><input bind:value={p.price} /></label>
								<label class="field full"><span>Für wen?</span><textarea bind:value={p.for} rows="2" use:autosize></textarea></label>
								<label class="field full"><span>Leistungen <small>(eine pro Zeile)</small></span><textarea value={lines(p.features)} oninput={(e) => (p.features = toLines(e.currentTarget.value))} rows="5"></textarea></label>
								<label class="field">
									<span>Knopf führt zu</span>
									<select bind:value={p.cta}>
										<option value="termin">Erstgespräch buchen</option>
										<option value="anfrage">Projekt anfragen</option>
									</select>
								</label>
							</div>
							<label class="switch"><input type="checkbox" bind:checked={p.highlight} /> Hervorheben (Rahmen im Farbverlauf)</label>
						{/snippet}
					</ItemList>
				</div>
				<div class="card stack" use:glow>
					<h2>Hosting & Wartung</h2>
					<div class="form-grid">
						<label class="field"><span>Titel</span><input bind:value={v.hosting.title} /></label>
						<label class="field"><span>Preis</span><input bind:value={v.hosting.price} /></label>
						<label class="field full"><span>Text</span><textarea bind:value={v.hosting.text} rows="2" use:autosize></textarea></label>
					</div>
					<label class="field"><span>Hinweis unter den Preisen</span><textarea bind:value={v.note} rows="2" use:autosize></textarea></label>
				</div>
			{:else if k === 'ueberMich'}
				<div class="card stack" use:glow>
					<label class="field"><span>Text <small>(Absätze mit Leerzeile trennen; der erste wird größer gesetzt)</small></span><textarea value={paras(v.paragraphs)} oninput={(e) => (v.paragraphs = toParas(e.currentTarget.value))} rows="12" use:autosize></textarea></label>
					<ImageField bind:value={v.photo} purpose="foto" label="Foto" />
					<p class="small faint">Ohne Foto stehen die Initialen in der Orbit-Grafik.</p>
				</div>
			{/if}

			<div class="form-actions sticky">
				<button class="btn ghost" type="submit"><Save size={15} /> Als Entwurf speichern</button>
				<button class="btn" type="submit" name="publish" value="on"><Rocket size={15} /> Speichern & veröffentlichen</button>
			</div>
		</form>

		<div class="card side" use:glow>
			{#if isLegal}
				<div class="legal-preview">
					<h2>Vorschau</h2>
					<div class="md">{@html markdown(v.markdown ?? '')}</div>
				</div>
			{:else}
				<SitePreview src={data.preview} {version} />
				<p class="small faint">Die Vorschau zeigt den gespeicherten Entwurf. Nach dem Speichern lädt sie neu.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.lead {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
		align-items: start;
	}

	.side {
		position: sticky;
		top: calc(var(--topbar) + 1rem);
		display: grid;
		gap: 0.6rem;
	}

	.mono-area {
		font-family: var(--font-mono) !important;
		font-size: 0.8rem !important;
		line-height: 1.7 !important;
	}

	.sticky {
		position: sticky;
		bottom: 0.75rem;
		z-index: 5;
		padding: 0.6rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: var(--glass-strong);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		justify-self: end;
	}

	.legal-preview {
		max-height: calc(100vh - 9rem);
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.md {
		margin-top: 0.8rem;
		color: var(--dust);
		font-size: 0.9rem;
	}

	.md :global(h2) {
		margin: 1.4rem 0 0.5rem;
		color: var(--star);
		font-size: 1.05rem;
	}

	.md :global(h3) {
		margin: 1rem 0 0.4rem;
		color: var(--star);
		font-size: 0.95rem;
	}

	.md :global(p + p) {
		margin-top: 0.6rem;
	}

	.md :global(ul) {
		display: grid;
		gap: 0.25rem;
		padding-left: 1.2rem;
	}

	.md :global(strong) {
		color: var(--star);
	}

	.md :global(a) {
		color: var(--accent);
	}

	.md :global(.todo) {
		padding: 0.05rem 0.35rem;
		border-radius: 4px;
		background: var(--accent-soft);
		color: var(--accent-strong);
	}

	.md :global(.notice) {
		padding: 0.7rem 0.9rem;
		border: 1px solid rgb(var(--accent-rgb) / 0.4);
		border-radius: 10px;
		background: var(--accent-soft);
	}

	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			position: static;
		}
	}
</style>
