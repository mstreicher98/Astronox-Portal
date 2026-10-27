<script lang="ts">
	import { page } from '$app/state';
	import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Lock, Pencil, Plus, Search, ShieldCheck, Star, Trash2, UserRound } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import { initials, relative } from '$lib/shared/format';
	import { avatarColor } from '$lib/shared/inbox';
	import { linkHost, linkHref } from '$lib/shared/tresor';
	import { LOCK_MINUTES, tresor, useVault } from '$lib/ui/tresor.svelte';
	import OtpCode from '../OtpCode.svelte';

	const vault = useVault();

	/* ---------- Suchen und filtern */
	let q = $state('');
	let filter = $state('alle');
	const shown = $derived(
		vault.items
			.filter((i) => {
				if (filter === 'favoriten' && !i.favorite) return false;
				if (filter === '2fa' && !i.otp) return false;
				if (filter.startsWith('k:') && i.category !== filter.slice(2)) return false;
				if (!q.trim()) return true;
				const hay = [i.title, i.username, i.category, i.notes, ...i.urls, ...i.fields.map((f) => (f.secret ? f.label : `${f.label} ${f.value}`))].join(' ').toLowerCase();
				return q.toLowerCase().trim().split(/\s+/).every((w) => hay.includes(w));
			})
			.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, 'de'))
	);

	let expanded = $state<number | null>(null);
	let revealed = $state<Record<string, boolean>>({});
	const toggle = (k: string) => (revealed[k] = !revealed[k]);
	const DOTS = '••••••••••';

	// Aus der Befehlspalette: ?neu=1
	if (page.url.searchParams.has('neu')) untrack(() => vault.edit(null));
</script>

<div class="page">
	<div class="page-head">
		<div>
			<h1>Passwörter</h1>
			<p class="lead">{vault.items.length} {vault.items.length === 1 ? 'Eintrag' : 'Einträge'} · sperrt sich nach {LOCK_MINUTES} Minuten ohne Aktivität</p>
		</div>
		<div class="actions">
			<button class="btn quiet sm" type="button" onclick={vault.openMaster}><KeyRound size={15} /> Master-Passwort</button>
			<button class="btn ghost sm" type="button" onclick={() => tresor.lock()}><Lock size={15} /> Sperren</button>
			<button class="btn" type="button" onclick={() => vault.edit(null)}><Plus size={16} /> Eintrag</button>
		</div>
	</div>

	<div class="row wrap">
		<label class="search">
			<Search size={16} />
			<input bind:value={q} placeholder="Titel, Benutzer, Link …" aria-label="Suchen" />
		</label>
		<select class="input filter" bind:value={filter} aria-label="Filter">
			<option value="alle">Alle</option>
			<option value="favoriten">Favoriten</option>
			<option value="2fa">Mit 2FA-Code</option>
			{#each vault.categories as c (c)}<option value="k:{c}">{c}</option>{/each}
		</select>
	</div>

	{#if !vault.ready}
		<div class="card empty"><p>Entschlüssle …</p></div>
	{:else if shown.length}
		<ul class="card flush entries stagger">
			{#each shown as i, n (i.id)}
				{@const href = i.urls.map(linkHref).find(Boolean)}
				{@const open = expanded === i.id}
				<li class:open style="--i: {n}">
					<div class="entry">
						<button class="main" type="button" aria-expanded={open} onclick={() => (expanded = open ? null : i.id)}>
							<span class="av" class:broken={i.broken} style:--c={avatarColor(i.title)}>{initials(i.title) || '?'}</span>
							<span class="txt">
								<strong>
									{i.title}
									{#if i.favorite}<Star size={12} class="star" />{/if}
									{#if i.otp}<ShieldCheck size={13} class="twofa" aria-label="mit 2FA-Code" />{/if}
								</strong>
								<small>{[i.username, i.urls[0] ? linkHost(i.urls[0]) : '', i.category].filter(Boolean).join(' · ')}</small>
							</span>
						</button>
						<div class="acts">
							{#if i.broken}
								<button class="btn quiet icon sm" type="button" aria-label="Löschen" title="Löschen" onclick={() => vault.remove(i)}><Trash2 size={15} /></button>
							{:else}
								{#if i.username}
									<button class="btn quiet icon sm wide-only" type="button" aria-label="Benutzer kopieren" title="Benutzer kopieren" onclick={() => vault.copy(i.username, 'Benutzer', false)}><UserRound size={15} /></button>
								{/if}
								{#if i.password}
									<button class="btn quiet icon sm" type="button" aria-label="Passwort kopieren" title="Passwort kopieren" onclick={() => vault.copy(i.password, 'Passwort', true)}><Copy size={15} /></button>
								{/if}
								{#if href}
									<a class="btn quiet icon sm" {href} target="_blank" rel="noopener noreferrer" aria-label="Öffnen" title="Öffnen"><ExternalLink size={15} /></a>
								{/if}
								<button class="btn quiet icon sm" type="button" aria-label="Bearbeiten" title="Bearbeiten" onclick={() => vault.edit(i)}><Pencil size={15} /></button>
							{/if}
						</div>
					</div>
					{#if open && !i.broken}
						<dl class="details" transition:slide={{ duration: 200 }}>
							{#if i.username}
								<dt>Benutzer</dt>
								<dd>
									<span class="val mono">{i.username}</span>
									<button class="btn quiet icon xs" type="button" aria-label="Benutzer kopieren" onclick={() => vault.copy(i.username, 'Benutzer', false)}><Copy size={13} /></button>
								</dd>
							{/if}
							{#if i.password}
								<dt>Passwort</dt>
								<dd>
									<span class="val mono secret">{revealed[i.id] ? i.password : DOTS}</span>
									<button class="btn quiet icon xs" type="button" aria-label={revealed[i.id] ? 'Verbergen' : 'Anzeigen'} onclick={() => toggle(`${i.id}`)}>
										{#if revealed[i.id]}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
									</button>
									<button class="btn quiet icon xs" type="button" aria-label="Passwort kopieren" onclick={() => vault.copy(i.password, 'Passwort', true)}><Copy size={13} /></button>
								</dd>
							{/if}
							{#if i.otp}
								<dt>2FA-Code</dt>
								<dd><OtpCode otp={i.otp} /></dd>
							{/if}
							{#each i.urls as u, k (k)}
								{@const link = linkHref(u)}
								<dt>{k ? '' : i.urls.length > 1 ? 'Links' : 'Link'}</dt>
								<dd>
									{#if link}<a class="val" href={link} target="_blank" rel="noopener noreferrer">{u} <ExternalLink size={12} /></a>{:else}<span class="val">{u}</span>{/if}
								</dd>
							{/each}
							{#each i.fields as f, k (k)}
								{@const key = `${i.id}:${k}`}
								<dt>{f.label || 'Feld'}</dt>
								<dd>
									<span class="val" class:mono={f.secret} class:secret={f.secret}>{f.secret && !revealed[key] ? DOTS : f.value}</span>
									{#if f.secret}
										<button class="btn quiet icon xs" type="button" aria-label={revealed[key] ? 'Verbergen' : 'Anzeigen'} onclick={() => toggle(key)}>
											{#if revealed[key]}<EyeOff size={13} />{:else}<Eye size={13} />{/if}
										</button>
									{/if}
									<button class="btn quiet icon xs" type="button" aria-label="{f.label || 'Feld'} kopieren" onclick={() => vault.copy(f.value, f.label || 'Feld', f.secret)}><Copy size={13} /></button>
								</dd>
							{/each}
							{#if i.notes}
								<dt>Notizen</dt>
								<dd><span class="val prewrap">{i.notes}</span></dd>
							{/if}
							<dt></dt>
							<dd class="faint small">geändert {relative(i.updatedAt)}</dd>
						</dl>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<div class="card empty">
			<KeyRound size={30} />
			<p>{q || filter !== 'alle' ? 'Nichts gefunden.' : 'Noch keine Einträge. Leg mit „Eintrag“ deinen ersten an.'}</p>
		</div>
	{/if}
</div>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
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

	.filter {
		width: auto;
		min-height: 2.35rem;
		padding: 0.3rem 2rem 0.3rem 0.9rem;
		border-radius: 999px;
	}

	.entries {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.entries li + li {
		border-top: 1px solid var(--line-soft);
	}

	.entries li.open {
		background: rgb(var(--accent-rgb) / 0.03);
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.75rem 0.35rem 0.4rem;
	}

	.main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
		padding: 0.45rem 0.5rem;
		border: 0;
		border-radius: 10px;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.main:hover strong {
		color: var(--accent);
	}

	.av {
		display: grid;
		place-items: center;
		flex: none;
		width: 2.2rem;
		height: 2.2rem;
		border-radius: 12px;
		background: color-mix(in srgb, var(--c) 16%, transparent);
		color: var(--c);
		font-size: 0.78rem;
		font-weight: 700;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 35%, transparent);
	}

	.av.broken {
		--c: var(--danger) !important;
	}

	.txt {
		display: grid;
		min-width: 0;
		line-height: 1.3;
	}

	.txt strong {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
		transition: color 0.2s;
	}

	.txt :global(.star) {
		flex: none;
		color: var(--warn);
		fill: currentColor;
	}

	.txt :global(.twofa) {
		flex: none;
		color: var(--accent);
	}

	.txt small {
		overflow: hidden;
		color: var(--dust-2);
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.acts {
		display: flex;
		flex: none;
		gap: 0.15rem;
	}

	/* ---------- Details */
	.details {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		gap: 0.45rem 1rem;
		margin: 0;
		padding: 0.25rem 1.25rem 1rem 3.65rem;
		font-size: 0.88rem;
	}

	dt {
		color: var(--dust-2);
		font-size: 0.8rem;
		padding-top: 0.15rem;
	}

	dd {
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
		margin: 0;
		min-width: 0;
	}

	.val {
		min-width: 0;
		padding-top: 0.1rem;
		overflow-wrap: anywhere;
	}

	a.val {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
	}

	a.val:hover {
		color: var(--accent);
	}

	.secret {
		color: var(--warn);
		letter-spacing: 0.04em;
	}

	.btn.xs {
		width: 1.6rem;
		height: 1.6rem;
		min-height: 0;
		padding: 0;
	}

	@media (max-width: 640px) {
		.wide-only {
			display: none;
		}

		.details {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.1rem;
			padding: 0 1rem 1rem;
		}

		dt:not(:empty) {
			margin-top: 0.5rem;
		}

		dt:empty {
			display: none;
		}
	}
</style>
