<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Bell, BellOff, BellRing, Smartphone, Trash2 } from '@lucide/svelte';
	import { relative } from '$lib/shared/format';
	import { glow } from '$lib/ui/actions';
	import { api, submit } from '$lib/ui/form';
	import { toast } from '$lib/ui/toast.svelte';

	let { data } = $props();
	let supported = $state(true);
	let current = $state<PushSubscription | null>(null);
	let permission = $state<NotificationPermission>('default');
	let busy = $state(false);
	let standalone = $state(false);

	$effect(() => {
		supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
		standalone = window.matchMedia('(display-mode: standalone)').matches;
		if (!supported) return;
		permission = Notification.permission;
		void navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => (current = s));
	});

	const b64 = (s: string) => {
		const pad = '='.repeat((4 - (s.length % 4)) % 4);
		const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(raw, (c) => c.charCodeAt(0));
	};

	async function enable() {
		busy = true;
		try {
			permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				toast('Benachrichtigungen wurden im Browser nicht erlaubt.', 'error');
				return;
			}
			const { publicKey } = await api<{ publicKey: string }>('/api/push');
			const reg = await navigator.serviceWorker.ready;
			current = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
			await api('/api/push', { action: 'abo', subscription: current.toJSON() });
			toast('Push auf diesem Gerät eingeschaltet');
			await invalidateAll();
		} catch (err) {
			toast((err as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function disable() {
		if (!current) return;
		await api('/api/push', { action: 'ende', subscription: current.toJSON() });
		await current.unsubscribe();
		current = null;
		toast('Push auf diesem Gerät ausgeschaltet');
		await invalidateAll();
	}

	async function test() {
		const r = await api<{ sent: number }>('/api/push', { action: 'test' });
		toast(r.sent ? `Test an ${r.sent} Gerät(e) geschickt` : 'Kein Gerät angemeldet', r.sent ? 'ok' : 'error');
	}

	const device = (ua: string | null) => {
		if (!ua) return 'Unbekanntes Gerät';
		const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : 'Gerät';
		const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
		return `${os} · ${br}`;
	};
</script>

<svelte:head><title>Benachrichtigungen – Einstellungen</title></svelte:head>

<div class="card stack" use:glow>
	<h2><BellRing size={17} /> Push aufs Handy</h2>
	<p class="small muted">Bei neuer Anfrage, neuem Termin, Absage, Mail von Kunden, Ausfall einer Kundenseite und fälligen Rechnungen.</p>
	{#if !supported}
		<p class="notice warn">Dieser Browser kann keine Push-Nachrichten. Am iPhone: Portal in Safari öffnen → Teilen → „Zum Home-Bildschirm“, dann hier aus der App heraus einschalten.</p>
	{:else}
		{#if !standalone}
			<p class="notice"><Smartphone size={16} /> Tipp: Am Handy das Portal zum Home-Bildschirm hinzufügen (Android: Menü → „App installieren“, iPhone: Teilen → „Zum Home-Bildschirm“). Am iPhone funktioniert Push nur so.</p>
		{/if}
		<div class="row wrap">
			{#if current}
				<span class="badge ok dot">Auf diesem Gerät aktiv</span>
				<button class="btn ghost sm" type="button" onclick={test}><Bell size={14} /> Test senden</button>
				<button class="btn quiet sm" type="button" onclick={disable}><BellOff size={14} /> Ausschalten</button>
			{:else}
				<button class="btn" class:busy type="button" onclick={enable} disabled={permission === 'denied'}><BellRing size={15} /> Auf diesem Gerät einschalten</button>
				{#if permission === 'denied'}<span class="small muted">Im Browser blockiert – in den Website-Einstellungen erlauben.</span>{/if}
			{/if}
		</div>
	{/if}

	{#if data.devices.length}
		<ul class="list devices">
			{#each data.devices as d (d.id)}
				<li>
					<Smartphone size={16} />
					<span class="txt"><strong>{device(d.userAgent)}</strong><small>angemeldet {relative(d.createdAt)}{d.lastUsedAt ? ` · zuletzt ${relative(d.lastUsedAt)}` : ''}</small></span>
					{#if current?.endpoint === d.endpoint}<span class="badge accent">dieses Gerät</span>{/if}
					<form method="POST" action="?/geraet_loeschen" use:enhance={submit()}>
						<input type="hidden" name="id" value={d.id} />
						<button class="btn quiet icon sm" type="submit" aria-label="Entfernen"><Trash2 size={14} /></button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<form method="POST" action="?/fristen" class="card stack" use:glow use:enhance={submit()}>
	<h2>Fristen</h2>
	<label class="field" style="max-width: 20rem">
		<span>Warnung vor Ablauf von Domains (Tage)</span>
		<input name="warnDays" type="number" min="1" max="90" value={data.monitor.warnDays} />
	</label>
	<p class="small faint">Zertifikate werden 14 Tage vor Ablauf gemeldet – Cloudflare und Let's Encrypt erneuern sie normalerweise selbst.</p>
	<div class="form-actions"><button class="btn ghost sm" type="submit">Speichern</button></div>
</form>

<style>
	h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.devices li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0;
		color: var(--dust);
	}

	.txt {
		flex: 1;
		display: grid;
		line-height: 1.3;
	}

	.txt strong {
		color: var(--star);
		font-weight: 600;
		font-size: 0.9rem;
	}

	.txt small {
		color: var(--dust-2);
		font-size: 0.77rem;
	}
</style>
