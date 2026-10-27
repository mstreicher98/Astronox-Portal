<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Fingerprint, Lock, LockOpen, ShieldCheck } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import Modal from '$lib/components/Modal.svelte';
	import type { OtpImport } from '$lib/shared/otp';
	import {
		deriveKey,
		deriveRaw,
		emptyEntry,
		ITERATIONS,
		keyFromRaw,
		makeCheck,
		MIN_MASTER,
		newSalt,
		normalize,
		passkeyKey,
		seal,
		tidy,
		unseal,
		unwrapKey,
		verify,
		wrapKey,
		type VaultEntry
	} from '$lib/shared/tresor';
	import { glow } from '$lib/ui/actions';
	import { ask } from '$lib/ui/confirm.svelte';
	import { api } from '$lib/ui/form';
	import { cancelled, passkeysSupported, prfSecret } from '$lib/ui/passkey';
	import { toast } from '$lib/ui/toast.svelte';
	import { setVault, tresor, type EditMode, type VaultItem } from '$lib/ui/tresor.svelte';
	import EntryForm from './EntryForm.svelte';
	import Strength from './Strength.svelte';

	/**
	 * Gemeinsamer Rahmen von Passwörter und Authenticator: einrichten, entsperren,
	 * entschlüsseln, speichern. Die Seiten selbst sehen nur entschlüsselte Einträge.
	 */
	let { data, children } = $props();

	const label = $derived(page.url.pathname.startsWith('/authenticator') ? 'Authenticator' : 'Passwörter');

	/* ---------- Entschlüsseln – sobald der Tresor offen ist oder neue Einträge kommen */
	// $derived bleibt dasselbe Objekt, wenn nur die Zähler im Menü neu laden
	const sealedItems = $derived(data.items);
	let items = $state<VaultItem[]>([]);
	let ready = $state(false);
	let run = 0;
	$effect(() => {
		const key = tresor.key;
		const list = sealedItems;
		const n = ++run;
		if (!key) {
			items = [];
			ready = false;
			return;
		}
		void Promise.all(
			list.map(async (i): Promise<VaultItem> => {
				try {
					return { ...normalize(await unseal(key, i)), id: i.id, updatedAt: i.updatedAt, broken: false };
				} catch {
					return { ...emptyEntry(), title: 'Eintrag nicht lesbar', id: i.id, updatedAt: i.updatedAt, broken: true };
				}
			})
		).then((out) => {
			if (n !== run) return;
			items = out;
			ready = true;
		});
	});

	const categories = $derived([...new Set(items.map((i) => i.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')));

	/* ---------- Einrichten, entsperren, vergessen */
	let master = $state('');
	let master2 = $state('');
	let busy = $state(false);
	let wrong = $state(false);
	let masterInput = $state<HTMLInputElement>();
	$effect(() => masterInput?.focus());

	async function setup(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		if (master.length < MIN_MASTER) return void toast(`Das Master-Passwort braucht mindestens ${MIN_MASTER} Zeichen.`, 'error');
		if (master !== master2) return void toast('Die beiden Eingaben stimmen nicht überein.', 'error');
		busy = true;
		try {
			const salt = newSalt();
			const key = await deriveKey(master, salt, ITERATIONS);
			await api('/api/tresor', { salt, iterations: ITERATIONS, check: await makeCheck(key) });
			await invalidateAll();
			master = master2 = '';
			tresor.open(key);
			toast('Tresor angelegt');
		} catch {
			// api() zeigt den Fehler schon an
		} finally {
			busy = false;
		}
	}

	async function unlock(e: SubmitEvent) {
		e.preventDefault();
		const v = data.vault;
		if (!v || busy) return;
		busy = true;
		wrong = false;
		try {
			const key = await deriveKey(master, v.salt, v.iterations);
			if (await verify(key, v.check)) {
				master = '';
				tresor.open(key);
			} else {
				wrong = true;
				masterInput?.select();
			}
		} finally {
			busy = false;
		}
	}

	/* ---------- Entsperren mit Fingerabdruck (Passkey mit PRF) */
	let canPasskey = $state(false);
	onMount(() => (canPasskey = passkeysSupported()));
	const pkFail = 'Mit Fingerabdruck hat es nicht geklappt – bitte mit dem Master-Passwort entsperren.';

	async function unlockWithPasskey() {
		const v = data.vault;
		const list = data.passkeys.unlock;
		if (!v || !list.length || busy) return;
		busy = true;
		wrong = false;
		try {
			const r = await prfSecret(data.rpId, list);
			const w = r && list.find((p) => p.id === r.id);
			if (!r || !w) return void toast(pkFail, 'error');
			const key = await unwrapKey(await passkeyKey(r.secret), w);
			if (!(await verify(key, v.check))) return void toast(pkFail, 'error');
			tresor.open(key);
		} catch (e) {
			if (!cancelled(e)) toast(pkFail, 'error');
		} finally {
			busy = false;
		}
	}

	let bioOpen = $state(false);
	let bioPw = $state('');

	/** Master-Passwort bestätigen, dann den Tresor-Schlüssel mit dem Passkey verpacken */
	async function enableBiometric(e: SubmitEvent) {
		e.preventDefault();
		const v = data.vault;
		if (!v || busy) return;
		busy = true;
		try {
			const raw = await deriveRaw(bioPw, v.salt, v.iterations);
			if (!(await verify(await keyFromRaw(raw), v.check))) return void toast('Das Master-Passwort stimmt nicht.', 'error');
			const salts = data.passkeys.ids.map((id) => ({ id, salt: newSalt() }));
			const r = await prfSecret(data.rpId, salts);
			const salt = r && salts.find((s) => s.id === r.id)?.salt;
			if (!r || !salt) return void toast('Dieses Gerät kann den Tresor nicht mit Fingerabdruck entsperren. Mit dem Master-Passwort geht es weiter wie bisher.', 'error');
			const wrapped = await wrapKey(await passkeyKey(r.secret), raw);
			raw.fill(0);
			await api('/api/tresor/passkey', { id: r.id, salt, ...wrapped });
			bioOpen = false;
			bioPw = '';
			toast('Der Tresor lässt sich jetzt mit Fingerabdruck entsperren');
			await invalidateAll();
		} catch (err) {
			if (!cancelled(err) && err instanceof Error && err.name !== 'Error') toast('Das Gerät hat abgelehnt. Bitte noch einmal versuchen.', 'error');
		} finally {
			busy = false;
		}
	}

	async function disableBiometric() {
		if (!(await ask('Entsperren mit Fingerabdruck ausschalten?', { detail: 'Danach geht der Tresor nur noch mit dem Master-Passwort auf.', confirm: 'Ausschalten' }))) return;
		try {
			await api('/api/tresor/passkey', undefined, 'DELETE');
			bioOpen = false;
			toast('Ausgeschaltet');
			await invalidateAll();
		} catch {
			// api() zeigt den Fehler schon an
		}
	}

	async function reset() {
		const ok = await ask('Tresor mit allen Einträgen löschen?', {
			detail: 'Das betrifft Passwörter und Authenticator. Ohne das Master-Passwort lassen sich die Einträge nicht entschlüsseln – auch nicht vom Server. Danach kannst du einen neuen Tresor anlegen.',
			confirm: 'Alles löschen'
		});
		if (!ok) return;
		try {
			await api('/api/tresor', undefined, 'DELETE');
			tresor.lock();
			await invalidateAll();
			toast('Tresor gelöscht');
		} catch {
			// api() zeigt den Fehler schon an
		}
	}

	/* ---------- Einträge */
	let formOpen = $state(false);
	let editing = $state<VaultItem | null>(null);
	let mode = $state<EditMode>('passwort');
	let draft = $state.raw<VaultEntry>(emptyEntry());

	function edit(i: VaultItem | null, m: EditMode = 'passwort') {
		editing = i;
		mode = m;
		draft = i ? normalize($state.snapshot(i)) : emptyEntry();
		formOpen = true;
	}

	async function save(entry: VaultEntry) {
		const key = tresor.key;
		if (!key) return;
		const clean = tidy(entry);
		if (!clean.title) return void toast('Bitte einen Titel angeben.', 'error');
		try {
			const body = await seal(key, clean);
			if (editing) await api(`/api/tresor/eintraege/${editing.id}`, body, 'PUT');
			else await api('/api/tresor/eintraege', body);
			toast(editing ? 'Gespeichert' : mode === 'konto' ? 'Konto hinzugefügt' : 'Eintrag angelegt');
			formOpen = false;
			await invalidateAll();
		} catch {
			// api() zeigt den Fehler schon an
		}
	}

	async function remove(i: VaultItem) {
		if (!(await ask('Eintrag löschen?', { detail: i.title, confirm: 'Löschen' }))) return;
		try {
			await api(`/api/tresor/eintraege/${i.id}`, undefined, 'DELETE');
			formOpen = false;
			toast('Gelöscht');
			await invalidateAll();
		} catch {
			// api() zeigt den Fehler schon an
		}
	}

	/** Mehrere Konten auf einmal (Export aus Google Authenticator) – schon vorhandene Schlüssel bleiben weg */
	async function importAccounts(list: OtpImport[]) {
		const key = tresor.key;
		if (!key) return;
		const known = new Set(items.map((i) => i.otp?.secret).filter(Boolean));
		const fresh = list.filter((a) => !known.has(a.secret));
		if (!fresh.length) return void toast('Diese Konten sind schon alle da.');
		const names = fresh.map((a) => a.issuer || a.account || 'Konto').join(', ');
		const skipped = list.length - fresh.length;
		const ok = await ask(`${fresh.length} ${fresh.length === 1 ? 'Konto' : 'Konten'} übernehmen?`, {
			detail: `${names}${skipped ? ` (${skipped} schon vorhanden)` : ''}`,
			confirm: 'Übernehmen',
			danger: false
		});
		if (!ok) return;
		try {
			for (const a of fresh) {
				const entry = tidy({ ...emptyEntry(), title: a.issuer || a.account || 'Konto', username: a.issuer ? a.account : '', otp: { secret: a.secret, algorithm: a.algorithm, digits: a.digits, period: a.period } });
				await api('/api/tresor/eintraege', await seal(key, entry));
			}
			toast(`${fresh.length} ${fresh.length === 1 ? 'Konto' : 'Konten'} übernommen`);
			formOpen = false;
		} catch {
			// api() zeigt den Fehler schon an
		}
		await invalidateAll();
	}

	/* ---------- Kopieren – Passwörter verschwinden nach 30 s aus der Zwischenablage */
	let clearTimer: ReturnType<typeof setTimeout> | undefined;
	async function copy(text: string, what: string, secret: boolean) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			return void toast('Kopieren hat nicht geklappt.', 'error');
		}
		if (!secret) return void toast(`${what} kopiert`);
		clearTimeout(clearTimer);
		clearTimer = setTimeout(() => void navigator.clipboard.writeText('').catch(() => {}), 30_000);
		toast(`${what} kopiert – die Zwischenablage wird in 30 s geleert`);
	}

	/* ---------- Master-Passwort ändern */
	let masterOpen = $state(false);
	let oldPw = $state('');
	let newPw = $state('');
	let newPw2 = $state('');

	async function changeMaster(e: SubmitEvent) {
		e.preventDefault();
		const v = data.vault;
		if (!v || !tresor.key || busy) return;
		if (newPw.length < MIN_MASTER) return void toast(`Das Master-Passwort braucht mindestens ${MIN_MASTER} Zeichen.`, 'error');
		if (newPw !== newPw2) return void toast('Die beiden Eingaben stimmen nicht überein.', 'error');
		if (items.some((i) => i.broken)) return void toast('Ein Eintrag ist nicht lesbar – lösch ihn zuerst.', 'error');
		busy = true;
		try {
			if (!(await verify(await deriveKey(oldPw, v.salt, v.iterations), v.check))) return void toast('Das bisherige Master-Passwort stimmt nicht.', 'error');
			const salt = newSalt();
			const next = await deriveKey(newPw, salt, ITERATIONS);
			const all = await Promise.all(items.map(async (i) => ({ id: i.id, ...(await seal(next, normalize($state.snapshot(i)))) })));
			await api('/api/tresor', { salt, iterations: ITERATIONS, check: await makeCheck(next), items: all });
			tresor.open(next);
			masterOpen = false;
			oldPw = newPw = newPw2 = '';
			toast('Master-Passwort geändert');
			await invalidateAll();
		} catch {
			// api() zeigt den Fehler schon an
		} finally {
			busy = false;
		}
	}

	// Gesperrt: offene Dialoge zu
	$effect(() => {
		if (tresor.unlocked) return;
		formOpen = false;
		masterOpen = false;
		bioOpen = false;
	});

	setVault({
		get items() {
			return items;
		},
		get ready() {
			return ready;
		},
		get categories() {
			return categories;
		},
		edit,
		remove,
		importAccounts,
		openMaster: () => (masterOpen = true),
		openBiometric: () => (bioOpen = true),
		copy
	});
</script>

<svelte:head><title>{label} – Astronox Portal</title></svelte:head>

{#if !data.vault}
	<div class="page">
		<div class="gate card" use:glow>
			<span class="orb"><ShieldCheck size={30} /></span>
			<h1>Tresor einrichten</h1>
			<ul class="facts">
				<li>Hier liegen deine <strong>Passwörter</strong> und die Schlüssel für den <strong>Authenticator</strong>. Verschlüsselt wird in deinem Browser, auf dem Server liegt nur unlesbarer Text.</li>
				<li>Zum Öffnen brauchst du ein eigenes <strong>Master-Passwort</strong> mit mindestens {MIN_MASTER} Zeichen. Nimm nicht das Passwort fürs Portal.</li>
				<li>Vergisst du es, lassen sich die Einträge <strong>nicht wiederherstellen</strong>. Bewahr es an einem sicheren Ort auf.</li>
			</ul>
			<form class="stack" onsubmit={setup}>
				<label class="field">
					<span>Master-Passwort</span>
					<input type="password" bind:this={masterInput} bind:value={master} autocomplete="new-password" required minlength={MIN_MASTER} />
				</label>
				<Strength password={master} />
				<label class="field">
					<span>Noch einmal</span>
					<input type="password" bind:value={master2} autocomplete="new-password" required />
				</label>
				<button class="btn" class:busy type="submit" disabled={busy}><ShieldCheck size={16} /> Tresor anlegen</button>
			</form>
		</div>
	</div>
{:else if !tresor.unlocked}
	<div class="page">
		<div class="gate card" use:glow>
			<span class="orb"><Lock size={28} /></span>
			<h1>{label}</h1>
			<p class="muted">{data.items.length} {data.items.length === 1 ? 'Eintrag' : 'Einträge'}, verschlüsselt mit deinem Master-Passwort.</p>
			{#if canPasskey && data.passkeys.unlock.length}
				<button class="btn wide" class:busy type="button" disabled={busy} onclick={unlockWithPasskey}><Fingerprint size={18} /> Mit Fingerabdruck entsperren</button>
				<div class="or"><span>oder mit dem Master-Passwort</span></div>
			{/if}
			<form class="stack" onsubmit={unlock}>
				<label class="field">
					<span>Master-Passwort</span>
					<input type="password" bind:this={masterInput} bind:value={master} autocomplete="current-password" required aria-invalid={wrong} />
				</label>
				{#if wrong}<p class="wrong small" role="alert">Das Master-Passwort stimmt nicht.</p>{/if}
				<button class="btn" class:busy type="submit" disabled={busy}><LockOpen size={16} /> {busy ? 'Entsperre …' : 'Entsperren'}</button>
			</form>
			<button class="forgot small" type="button" onclick={reset}>Master-Passwort vergessen?</button>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<Modal bind:open={formOpen} title={editing ? (mode === 'konto' ? 'Konto bearbeiten' : 'Eintrag bearbeiten') : mode === 'konto' ? 'Konto hinzufügen' : 'Neuer Eintrag'} wide>
	<EntryForm entry={draft} {mode} {categories} onsave={save} onimport={importAccounts} oncancel={() => (formOpen = false)} ondelete={editing ? () => remove(editing!) : undefined} />
</Modal>

<Modal bind:open={bioOpen} title="Mit Fingerabdruck entsperren">
	<div class="stack">
		{#if !canPasskey}
			<p class="small muted">Dieser Browser kann keine Passkeys – hier geht der Tresor nur mit dem Master-Passwort auf.</p>
		{:else if !data.passkeys.ids.length}
			<p class="small muted">Richte zuerst unter <a href="/einstellungen/sicherheit">Einstellungen → Sicherheit</a> „Fingerabdruck & Gesicht“ für dieses Gerät ein. Danach kannst du ihn hier für den Tresor einschalten.</p>
		{:else}
			{#if data.passkeys.unlock.length}
				<p class="small muted">Eingeschaltet für: <strong>{data.passkeys.unlock.map((p) => p.name).join(', ')}</strong></p>
			{/if}
			<p class="small muted">Der Tresor-Schlüssel wird mit einem Geheimnis verschlüsselt, das nur dein Passkey liefert – nach Fingerabdruck oder Gesicht. Der Server kann ihn weiterhin nicht lesen. Ändert sich das Master-Passwort, schaltest du es hier neu ein.</p>
			<form class="stack" onsubmit={enableBiometric}>
				<label class="field">
					<span>Master-Passwort zur Bestätigung</span>
					<input type="password" bind:value={bioPw} autocomplete="current-password" required />
				</label>
				<div class="form-actions">
					{#if data.passkeys.unlock.length}
						<button class="btn quiet" type="button" onclick={disableBiometric}>Ausschalten</button>
					{/if}
					<button class="btn" class:busy type="submit" disabled={busy}><Fingerprint size={16} /> {data.passkeys.unlock.length ? 'Für dieses Gerät einschalten' : 'Einschalten'}</button>
				</div>
			</form>
		{/if}
	</div>
</Modal>

<Modal bind:open={masterOpen} title="Master-Passwort ändern">
	<form class="stack" onsubmit={changeMaster}>
		<p class="small muted">Alle Einträge werden dabei mit dem neuen Passwort neu verschlüsselt.</p>
		<label class="field">
			<span>Bisheriges Master-Passwort</span>
			<input type="password" bind:value={oldPw} autocomplete="current-password" required />
		</label>
		<label class="field">
			<span>Neues Master-Passwort</span>
			<input type="password" bind:value={newPw} autocomplete="new-password" required minlength={MIN_MASTER} />
		</label>
		<Strength password={newPw} />
		<label class="field">
			<span>Noch einmal</span>
			<input type="password" bind:value={newPw2} autocomplete="new-password" required />
		</label>
		<div class="form-actions">
			<button class="btn ghost" type="button" onclick={() => (masterOpen = false)}>Abbrechen</button>
			<button class="btn" class:busy type="submit" disabled={busy}>Ändern</button>
		</div>
	</form>
</Modal>

<style>
	.gate {
		display: grid;
		justify-items: center;
		gap: 1rem;
		width: 100%;
		max-width: 28rem;
		margin: 6vh auto 0;
		padding: 2rem 1.75rem;
		text-align: center;
	}

	.gate form {
		width: 100%;
		text-align: left;
	}

	.gate form .btn {
		width: 100%;
	}

	.orb {
		display: grid;
		place-items: center;
		width: 4.5rem;
		height: 4.5rem;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 30%, rgb(var(--accent-rgb) / 0.22), var(--nebula-soft) 70%);
		color: var(--accent);
		box-shadow: 0 0 40px -8px rgb(var(--accent-rgb) / 0.45);
	}

	.facts {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
		color: var(--dust);
		font-size: 0.9rem;
		text-align: left;
	}

	.facts li {
		position: relative;
		padding-left: 1.1rem;
	}

	.facts li::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.55em;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--accent);
	}

	.facts strong {
		color: var(--star);
	}

	.wrong {
		margin: 0;
		color: var(--danger);
	}

	.wide {
		width: 100%;
	}

	.or {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
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

	.forgot {
		padding: 0;
		border: 0;
		background: none;
		color: var(--dust-2);
		cursor: pointer;
	}

	.forgot:hover {
		color: var(--star);
		text-decoration: underline;
	}
</style>
