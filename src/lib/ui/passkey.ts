import { base64URLStringToBuffer, browserSupportsWebAuthn, startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from './form';

/** Fingerabdruck und Gesicht über Passkeys (WebAuthn) – Gegenstück zu $lib/server/passkeys */

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn();

/** Dialog am Handy abgebrochen – kein Fehler, den man melden muss */
export const cancelled = (e: unknown) => e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError');

export async function loginWithPasskey(ziel: string | null): Promise<string> {
	const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>('/api/passkey/anmelden', { schritt: 'optionen' });
	const response = await startAuthentication({ optionsJSON });
	return (await api<{ ziel: string }>('/api/passkey/anmelden', { schritt: 'pruefen', response, ziel })).ziel;
}

export async function registerPasskey(code: string): Promise<string> {
	const optionsJSON = await api<PublicKeyCredentialCreationOptionsJSON>('/api/passkey', { schritt: 'optionen', code });
	const response = await startRegistration({ optionsJSON });
	return (await api<{ name: string }>('/api/passkey', { schritt: 'pruefen', response })).name;
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * PRF-Geheimnis eines der Passkeys (Fingerabdruck am Gerät). null, wenn das Gerät die
 * Erweiterung nicht kann – dann geht es nur mit dem Master-Passwort.
 */
export async function prfSecret(rpId: string, creds: { id: string; salt: string }[]): Promise<{ id: string; secret: ArrayBuffer } | null> {
	const cred = (await navigator.credentials.get({
		publicKey: {
			challenge: crypto.getRandomValues(new Uint8Array(32)),
			rpId,
			allowCredentials: creds.map((c) => ({ type: 'public-key' as const, id: base64URLStringToBuffer(c.id) })),
			userVerification: 'required',
			extensions: { prf: { evalByCredential: Object.fromEntries(creds.map((c) => [c.id, { first: bytes(c.salt) }])) } } as AuthenticationExtensionsClientInputs
		}
	})) as PublicKeyCredential | null;
	const results = cred?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined;
	const first = results?.prf?.results?.first;
	return cred && first ? { id: cred.id, secret: first } : null;
}
