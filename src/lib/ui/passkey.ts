import { base64URLStringToBuffer, browserSupportsWebAuthn, startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from './form';

/** Fingerabdruck und Gesicht über Passkeys (WebAuthn) – Gegenstück zu $lib/server/passkeys */

export const passkeysSupported = () => typeof window !== 'undefined' && browserSupportsWebAuthn();

/** Dialog am Handy abgebrochen – kein Fehler, den man melden muss */
export const cancelled = (e: unknown) => e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'AbortError');

/** Verständlicher Grund, warum der Fingerabdruck nicht geklappt hat (mit Fehlername für die Fehlersuche) */
export function passkeyProblem(e: unknown): string {
	const name = e instanceof Error ? e.name : '';
	if (name === 'NotAllowedError') return 'Abgebrochen – oder auf diesem Gerät ist kein Passkey fürs Portal. Den richtest du unter Einstellungen → Sicherheit ein.';
	if (name === 'AbortError') return 'Abgebrochen.';
	if (name === 'NotSupportedError') return 'Dieser Passwort-Manager kann das nicht (NotSupportedError).';
	if (name === 'SecurityError') return 'Die Adresse passt nicht zum Passkey (SecurityError).';
	if (name === 'InvalidStateError') return 'Auf diesem Gerät gibt es schon einen Passkey fürs Portal.';
	return `Das hat nicht geklappt${name && name !== 'Error' ? ` (${name})` : ''}.`;
}

export async function loginWithPasskey(ziel: string | null): Promise<string> {
	const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>('/api/passkey/anmelden', { schritt: 'optionen' });
	const response = await startAuthentication({ optionsJSON });
	return (await api<{ ziel: string }>('/api/passkey/anmelden', { schritt: 'pruefen', response, ziel })).ziel;
}

export async function registerPasskey(code: string): Promise<{ name: string; prf: boolean | null }> {
	const optionsJSON = await api<PublicKeyCredentialCreationOptionsJSON>('/api/passkey', { schritt: 'optionen', code });
	const response = await startRegistration({ optionsJSON });
	return api<{ name: string; prf: boolean | null }>('/api/passkey', { schritt: 'pruefen', response });
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * PRF-Geheimnis eines der Passkeys (Fingerabdruck am Gerät). null, wenn der Passwort-Manager
 * die Erweiterung nicht kann – dann geht es nur mit dem Master-Passwort.
 * Haben alle dasselbe Salz, reicht „eval“ – das können mehr Passwort-Manager als „evalByCredential“.
 */
export async function prfSecret(rpId: string, creds: { id: string; salt: string }[]): Promise<{ id: string; secret: ArrayBuffer } | null> {
	const same = creds.every((c) => c.salt === creds[0]?.salt);
	const prf = same ? { eval: { first: bytes(creds[0].salt) } } : { evalByCredential: Object.fromEntries(creds.map((c) => [c.id, { first: bytes(c.salt) }])) };
	const cred = (await navigator.credentials.get({
		publicKey: {
			challenge: crypto.getRandomValues(new Uint8Array(32)),
			rpId,
			allowCredentials: creds.map((c) => ({ type: 'public-key' as const, id: base64URLStringToBuffer(c.id) })),
			userVerification: 'required',
			extensions: { prf } as AuthenticationExtensionsClientInputs
		}
	})) as PublicKeyCredential | null;
	const results = cred?.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } } | undefined;
	const first = results?.prf?.results?.first;
	return cred && first ? { id: cred.id, secret: first } : null;
}
