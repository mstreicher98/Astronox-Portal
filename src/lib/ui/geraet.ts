import { startAuthentication, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { unwrapKey, wrapKey, type Sealed } from '$lib/shared/tresor';
import { api } from './form';

/**
 * Tresor mit Fingerabdruck ohne WebAuthn-PRF: ein Schlüssel nur für dieses Gerät, gespeichert
 * in IndexedDB als nicht exportierbarer CryptoKey – JavaScript kann damit ver- und entschlüsseln,
 * ihn aber nie auslesen. Das damit verpackte Paket liegt beim Server und kommt erst nach dem
 * Fingerabdruck zurück (/api/tresor/geraet).
 */

const DB = 'astronox-tresor';
const STORE = 'geraet';
const KEY = 'schluessel';

interface Stored {
	id: string;
	key: CryptoKey;
}

function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
	return new Promise((resolve, reject) => {
		const open = indexedDB.open(DB, 1);
		open.onupgradeneeded = () => open.result.createObjectStore(STORE);
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const tx = open.result.transaction(STORE, mode);
			const req = run(tx.objectStore(STORE));
			tx.oncomplete = () => {
				open.result.close();
				resolve(req.result as T);
			};
			tx.onerror = () => reject(tx.error);
		};
	});
}

/** Gespeicherter Geräte-Schlüssel – null, wenn keiner da ist oder der Speicher fehlt */
export async function deviceKey(): Promise<Stored | null> {
	try {
		const v = await store<Stored | undefined>('readonly', (s) => s.get(KEY));
		return v?.id && v.key ? v : null;
	} catch {
		return null;
	}
}

export async function forgetDevice() {
	try {
		await store('readwrite', (s) => s.delete(KEY));
	} catch {
		// nichts zu vergessen
	}
}

/** Tresor-Schlüssel (Rohbytes) für dieses Gerät verpacken und das Paket beim Server ablegen */
export async function bindDevice(raw: Uint8Array): Promise<void> {
	const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
	const wrapped = await wrapKey(key, raw);
	const { id } = await api<{ id: string }>('/api/tresor/geraet', { schritt: 'speichern', ...wrapped });
	await store('readwrite', (s) => s.put({ id, key } satisfies Stored, KEY));
	// Browser bitten, den Speicher nicht von selbst zu leeren
	await navigator.storage?.persist?.().catch(() => false);
}

/** Fingerabdruck → Paket vom Server → mit dem Geräte-Schlüssel auspacken */
export async function openWithDevice(device: Stored): Promise<CryptoKey> {
	const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>('/api/tresor/geraet', { schritt: 'optionen', id: device.id });
	const response = await startAuthentication({ optionsJSON });
	const wrapped = await api<Sealed>('/api/tresor/geraet', { schritt: 'oeffnen', id: device.id, response });
	return unwrapKey(device.key, wrapped);
}
