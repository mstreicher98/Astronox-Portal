import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse,
	type AuthenticationResponseJSON,
	type RegistrationResponseJSON
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

/**
 * Anmelden mit Fingerabdruck oder Gesicht (Passkeys, WebAuthn). Das Handy prüft den Finger,
 * der Server nur die Signatur mit dem gespeicherten öffentlichen Schlüssel.
 * Hier nur die Prüfung – Datenbank und Sitzung erledigen die Routen.
 */

/** Wo das Portal läuft: hinter dem Tunnel kommt das aus ORIGIN, lokal aus der Anfrage */
export interface RelyingParty {
	origin: string;
	rpID: string;
}

export const relyingParty = (url: URL): RelyingParty => ({ origin: url.origin, rpID: url.hostname });

/* ------------------------------------------------------------------ Challenges: einmalig, 5 Minuten */

/** neu = einrichten, anmelden = ohne Konto, tresor = Tresor-Teil freigeben (angemeldet) */
type Purpose = 'neu' | 'anmelden' | 'tresor';
const pending = new Map<string, { purpose: Purpose; userId: number | null; exp: number }>();

function remember(challenge: string, purpose: Purpose, userId: number | null) {
	const now = Date.now();
	for (const [c, p] of pending) if (p.exp < now) pending.delete(c);
	if (pending.size > 500) pending.clear();
	pending.set(challenge, { purpose, userId, exp: now + 5 * 60_000 });
}

function consume(challenge: string, purpose: Purpose, userId: number | null): boolean {
	const p = pending.get(challenge);
	pending.delete(challenge);
	return !!p && p.purpose === purpose && p.userId === userId && p.exp > Date.now();
}

/* ------------------------------------------------------------------ Einrichten */

export async function registrationOptions(rp: RelyingParty, user: { id: number; email: string; name: string }, existing: { id: string; transports: string[] }[]) {
	const options = await generateRegistrationOptions({
		rpName: 'Astronox Portal',
		rpID: rp.rpID,
		userName: user.email,
		userDisplayName: user.name,
		userID: new TextEncoder().encode(`portal-${user.id}`),
		attestationType: 'none',
		excludeCredentials: existing,
		// auf dem Gerät gespeichert und immer mit Fingerabdruck, Gesicht oder PIN
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
		// PRF: damit lässt sich später auch der Tresor entsperren
		extensions: { prf: {} } as never
	});
	remember(options.challenge, 'neu', user.id);
	return options;
}

export async function verifyNew(rp: RelyingParty, userId: number, response: RegistrationResponseJSON) {
	const v = await verifyRegistrationResponse({
		response,
		expectedChallenge: (c) => consume(c, 'neu', userId),
		expectedOrigin: rp.origin,
		expectedRPID: rp.rpID,
		requireUserVerification: true
	});
	if (!v.verified) return null;
	const c = v.registrationInfo.credential;
	// kann der Passwort-Manager PRF (Tresor entsperren)? Manche melden nichts – dann unbekannt
	const prf = (response.clientExtensionResults as { prf?: { enabled?: boolean } } | undefined)?.prf?.enabled;
	return { id: c.id, publicKey: isoBase64URL.fromBuffer(c.publicKey), counter: c.counter, transports: c.transports ?? [], prf: typeof prf === 'boolean' ? prf : null };
}

/* ------------------------------------------------------------------ Anmelden */

type Stored = { id: string; publicKey: string; counter: number; transports: string[] };

export async function loginOptions(rp: RelyingParty) {
	// ohne Liste: das Handy bietet die Passkeys für diese Seite selbst an
	const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required' });
	remember(options.challenge, 'anmelden', null);
	return options;
}

export const verifyLogin = (rp: RelyingParty, response: AuthenticationResponseJSON, stored: Stored) => verifyAssertion(rp, 'anmelden', null, response, stored);

/* ------------------------------------------------------------------ Tresor freigeben (angemeldet) */

export async function vaultOptions(rp: RelyingParty, userId: number, allow: { id: string; transports: string[] }[]) {
	const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'required', allowCredentials: allow });
	remember(options.challenge, 'tresor', userId);
	return options;
}

export const verifyVault = (rp: RelyingParty, userId: number, response: AuthenticationResponseJSON, stored: Stored) => verifyAssertion(rp, 'tresor', userId, response, stored);

async function verifyAssertion(rp: RelyingParty, purpose: Purpose, userId: number | null, response: AuthenticationResponseJSON, stored: Stored) {
	const v = await verifyAuthenticationResponse({
		response,
		expectedChallenge: (c) => consume(c, purpose, userId),
		expectedOrigin: rp.origin,
		expectedRPID: rp.rpID,
		credential: { id: stored.id, publicKey: isoBase64URL.toBuffer(stored.publicKey), counter: stored.counter, transports: stored.transports as never },
		requireUserVerification: true
	});
	return v.verified ? { counter: v.authenticationInfo.newCounter } : null;
}

/** Gerätename aus dem Browser, z. B. „Android – Chrome“ */
export function deviceName(userAgent: string | null): string {
	const ua = userAgent ?? '';
	const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Gerät';
	const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
	return browser ? `${os} – ${browser}` : os;
}
