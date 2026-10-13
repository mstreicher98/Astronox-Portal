/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Service Worker des Portals:
 *  - hält die Programmdateien vor, damit das Portal am Handy sofort startet
 *  - zeigt Push-Nachrichten an und öffnet beim Antippen die passende Seite
 * Daten werden bewusst nicht zwischengespeichert – sie kommen immer frisch vom Server.
 */

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `portal-${version}`;
const ASSETS = [...build, ...files.filter((f) => !f.endsWith('.webmanifest'))];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(event.request)));
	}
});

sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string; tag?: string } = {};
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { title: event.data?.text() };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title || 'Astronox Portal', {
			body: data.body,
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			tag: data.tag,
			data: { url: data.url || '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url || '/', sw.location.origin).href;
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
			for (const c of list) {
				if ('focus' in c) {
					void (c as WindowClient).navigate(target);
					return (c as WindowClient).focus();
				}
			}
			return sw.clients.openWindow(target);
		})
	);
});
