<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Fingerprint, Lock, LockOpen, ShieldCheck } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
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
	import { bindDevice, deviceKey, forgetDevice, openWithDevice } from '$lib/ui/geraet';
	import { passkeyProblem, passkeysSupported, prfSecret } from '$lib/ui/passkey';
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
			const raw = await deriveRaw(master, v.salt, v.iterations);
			const key = await keyFromRaw(raw);
			if (await verify(key, v.check)) {
				master = '';
				tresor.open(key);
				maybeOffer(raw);
			} else {
				raw.fill(0);
				wrong = true;
				masterInput?.select();
			}
		} finally {
			busy = false;
		}
	}

	/*
	 * ---------- Entsperren mit Fingerabdruck. Zwei Wege:
	 *  - PRF: der Passkey liefert ein Geheimnis, damit ist der Tresor-Schlüssel verpackt (geht auf
	 *    allen Geräten mit diesem Passkey)
	 *  - Gerät: ohne PRF ein Schlüssel nur auf diesem Gerät; das Paket gibt der Server erst nach dem
	 *    Fingerabdruck heraus ($lib/ui/geraet)
	 */
	let canPasskey = $state(false);
	let device = $state<Awaited<ReturnType<typeof deviceKey>>>(null);
	onMount(async () => {
		canPasskey = passkeysSupported();
		device = await deviceKey();
	});
	// nach neuem Master-Passwort oder „Ausschalten“ kennt der Server das Gerät nicht mehr
	const thisDevice = $derived(device && data.devices.some((d) => d.id === device!.id) ? device : null);
	const canUnlock = $derived(canPasskey && (!!thisDevice || data.passkeys.unlock.length > 0));
	const STALE = 'Der Fingerabdruck-Schlüssel passt nicht mehr (Master-Passwort geändert?). Bitte mit dem Master-Passwort entsperren und neu einschalten.';

	/** Fehler mit Grund melden – Fehler aus api() stehen schon da */
	const report = (e: unknown) => e instanceof Error && e.name !== 'Error' && toast(passkeyProblem(e), 'error', 9000);

	async function unlockWithPasskey() {
		const v = data.vault;
		if (!v || !canUnlock || busy) return;
		busy = true;
		wrong = false;
		try {
			let key: CryptoKey | null = null;
			if (thisDevice) {
				key = await openWithDevice(thisDevice);
			} else {
				const list = data.passkeys.unlock;
				const r = await prfSecret(data.rpId, list);
				const w = r && list.find((p) => p.id === r.id);
				if (!r || !w) return void toast('Dein Passwort-Manager hat diesmal kein Geheimnis geliefert. Bitte mit dem Master-Passwort entsperren.', 'error', 9000);
				key = await unwrapKey(await passkeyKey(r.secret), w).catch(() => null);
			}
			if (!key || !(await verify(key, v.check))) return void toast(STALE, 'error', 9000);
			tresor.open(key);
		} catch (e) {
			if (e instanceof DOMException && e.name === 'OperationError') toast(STALE, 'error', 9000);
			else report(e);
		} finally {
			busy = false;
		}
	}

	/**
	 * Tresor-Schlüssel für den Fingerabdruck verpacken: zuerst mit PRF versuchen (ein Salz für alle
	 * Passkeys – dann reicht „eval“), sonst an dieses Gerät binden. Melden alle Passkeys schon beim
	 * Einrichten „kein PRF“, gleich ans Gerät – ohne unnötige Abfrage.
	 */
	async function enroll(raw: Uint8Array<ArrayBuffer>): Promise<boolean> {
		if (!data.passkeys.noPrf) {
			const salt = data.passkeys.unlock[0]?.salt ?? newSalt();
			const r = await prfSecret(data.rpId, data.passkeys.ids.map((id) => ({ id, salt })));
			if (r) {
				const wrapped = await wrapKey(await passkeyKey(r.secret), raw);
				await api('/api/tresor/passkey', { id: r.id, salt, ...wrapped });
				toast('Ab jetzt geht der Tresor mit Fingerabdruck auf – auf allen Geräten mit diesem Passkey');
				await invalidateAll();
				return true;
			}
		}
		await bindDevice(raw);
		device = await deviceKey();
		toast('Ab jetzt geht der Tresor auf diesem Gerät mit Fingerabdruck auf');
		await invalidateAll();
		return true;
	}

	/* Nach dem Entsperren mit dem Master-Passwort einmal anbieten – ohne es noch einmal einzutippen.
	   Der Rohschlüssel bleibt dafür höchstens zwei Minuten im Speicher. */
	const NO_OFFER = 'tresor-fingerabdruck-nein';
	let offer = $state(false);
	let offerRaw: Uint8Array<ArrayBuffer> | null = null;
	let offerTimer: ReturnType<typeof setTimeout> | undefined;

	function maybeOffer(raw: Uint8Array<ArrayBuffer>) {
		let declined = false;
		try {
			declined = localStorage.getItem(NO_OFFER) === '1';
		} catch {
			// ohne Speicher eben jedes Mal fragen
		}
		if (!canPasskey || !data.passkeys.ids.length || canUnlock || declined) return void raw.fill(0);
		offerRaw = raw;
		offer = true;
		offerTimer = setTimeout(dropOffer, 120_000);
	}

	function dropOffer() {
		offer = false;
		offerRaw?.fill(0);
		offerRaw = null;
		clearTimeout(offerTimer);
	}

	async function acceptOffer() {
		if (!offerRaw || busy) return;
		busy = true;
		try {
			await enroll(offerRaw);
		} catch (e) {
			report(e);
		} finally {
			busy = false;
			dropOffer();
		}
	}

	function declineOffer() {
		try {
			localStorage.setItem(NO_OFFER, '1');
		} catch {
			// nur eine Annehmlichkeit
		}
		dropOffer();
	}

	let bioOpen = $state(false);
	let bioPw = $state('');

	/** Master-Passwort bestätigen, dann den Tresor-Schlüssel mit dem Passkey verpacken */
	async function enableBiometric(e: SubmitEvent) {
		e.preventDefault();
		const v = data.vault;
		if (!v || busy) return;
		busy = true;
		const raw = await deriveRaw(bioPw, v.salt, v.iterations);
		try {
			if (!(await verify(await keyFromRaw(raw), v.check))) return void toast('Das Master-Passwort stimmt nicht.', 'error');
			if (await enroll(raw)) {
				bioOpen = false;
				bioPw = '';
			}
		} catch (err) {
			report(err);
		} finally {
			raw.fill(0);
			busy = false;
		}
	}

	async function disableBiometric() {
		if (!(await ask('Entsperren mit Fingerabdruck ausschalten?', { detail: 'Danach geht der Tresor nur noch mit dem Master-Passwort auf.', confirm: 'Ausschalten' }))) return;
		try {
			await api('/api/tresor/passkey', undefined, 'DELETE');
			await forgetDevice();
			device = null;
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
		dropOffer();
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
			{#if canUnlock}
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
	{#if offer}
		<div class="offer card" role="dialog" aria-label="Fingerabdruck einschalten" transition:fly={{ y: 24, duration: 300 }}>
			<span class="orb small"><Fingerprint size={20} /></span>
			<p><strong>Nächstes Mal mit Fingerabdruck?</strong><br /><span class="small muted">Dann musst du das Master-Passwort hier nicht mehr eintippen.</span></p>
			<div class="row">
				<button class="btn quiet sm" type="button" onclick={declineOffer}>Nein danke</button>
				<button class="btn sm" class:busy type="button" disabled={busy} onclick={acceptOffer}>Einschalten</button>
			</div>
		</div>
	{/if}
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
			{@const on = [...data.passkeys.unlock.map((p) => p.name), ...data.devices.map((d) => (d.id === thisDevice?.id ? `${d.name} (dieses Gerät)` : d.name))]}
			{#if on.length}
				<p class="small muted">Eingeschaltet für: <strong>{on.join(', ')}</strong></p>
			{/if}
			<p class="small muted">
				Der Tresor-Schlüssel wird so verpackt, dass er nur nach Fingerabdruck oder Gesicht wieder aufgeht – der Server kann ihn weiterhin nicht lesen. Kann dein Passwort-Manager das nicht selbst
				(WebAuthn-PRF), bleibt ein Teil davon nur auf diesem Gerät. Ändert sich das Master-Passwort, schaltest du es neu ein.
			</p>
			<form class="stack" onsubmit={enableBiometric}>
				<label class="field">
					<span>Master-Passwort zur Bestätigung</span>
					<input type="password" bind:value={bioPw} autocomplete="current-password" required />
				</label>
				<div class="form-actions">
					{#if on.length}
						<button class="btn quiet" type="button" onclick={disableBiometric}>Überall ausschalten</button>
					{/if}
					<button class="btn" class:busy type="submit" disabled={busy}><Fingerprint size={16} /> {on.length ? 'Für dieses Gerät einschalten' : 'Einschalten'}</button>
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

	/* über der Tab-Leiste am Handy */
	.offer {
		position: fixed;
		left: 50%;
		bottom: calc(env(safe-area-inset-bottom) + 5.5rem);
		z-index: 60;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		width: min(30rem, calc(100vw - 2rem));
		padding: 0.9rem 1rem;
		translate: -50% 0;
		box-shadow: 0 20px 50px -15px rgb(0 0 0 / 0.7);
	}

	.offer p {
		flex: 1;
		min-width: 12rem;
		margin: 0;
		line-height: 1.4;
	}

	.offer .row {
		margin-left: auto;
	}

	.orb.small {
		flex: none;
		width: 2.6rem;
		height: 2.6rem;
	}

	@media (min-width: 900px) {
		.offer {
			bottom: 1.5rem;
		}
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
