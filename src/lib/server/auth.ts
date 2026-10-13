import { createHash, createHmac, hkdfSync, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import { and, eq, lt } from 'drizzle-orm';
import { db } from './db';
import { sessions, users, type User } from './db/schema';
import { decrypt, encrypt } from './secret';
import { verifyCode } from './totp';

/**
 * Anmeldung: Passwort + Code aus der Authenticator-App (Pflicht).
 * Sitzungen liegen in der Datenbank, im Cookie steht nur ein Zufallswert.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const SESSION_COOKIE = 'portal_sitzung';
const PENDING_COOKIE = 'portal_2fa';
const SESSION_DAYS = 30;

export async function hashPassword(pw: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scrypt(pw, salt, 64, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
	const [kind, n, r, p, salt, hash] = stored.split('$');
	if (kind !== 'scrypt' || !hash) return false;
	const expected = Buffer.from(hash, 'base64url');
	const got = await scrypt(pw, Buffer.from(salt, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
	return timingSafeEqual(got, expected);
}

export function passwordProblem(pw: string): string | null {
	if (pw.length < 12) return 'Das Passwort braucht mindestens 12 Zeichen.';
	if (pw.length > 200) return 'Das Passwort ist zu lang.';
	if (/^(.)\1+$/.test(pw)) return 'Das Passwort ist zu einfach.';
	return null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/* ------------------------------------------------------------------ Sitzungen */

const cookieOpts = (secure: boolean, maxAgeDays: number) => ({
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure,
	maxAge: maxAgeDays * 86_400
});

export async function createSession(cookies: Cookies, userId: number, userAgent: string | null, secure: boolean) {
	const token = randomBytes(32).toString('base64url');
	await db.insert(sessions).values({
		id: sha256(token),
		userId,
		userAgent: userAgent?.slice(0, 300) ?? null,
		expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
	});
	await db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, userId));
	cookies.set(SESSION_COOKIE, token, cookieOpts(secure, SESSION_DAYS));
}

/** Liest die Sitzung aus dem Cookie und verlängert sie, wenn sie benutzt wird */
export async function readSession(cookies: Cookies, secure: boolean): Promise<{ user: User; sessionId: string } | null> {
	const token = cookies.get(SESSION_COOKIE);
	if (!token || token.length > 100) return null;
	const id = sha256(token);
	const [row] = await db.select({ s: sessions, u: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(eq(sessions.id, id)).limit(1);
	if (!row || Date.parse(row.s.expiresAt) < Date.now()) {
		if (row) await db.delete(sessions).where(eq(sessions.id, id));
		cookies.delete(SESSION_COOKIE, { path: '/' });
		return null;
	}
	// Höchstens einmal pro Stunde schreiben
	if (Date.now() - Date.parse(row.s.lastSeenAt) > 3_600_000) {
		const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
		await db.update(sessions).set({ lastSeenAt: new Date().toISOString(), expiresAt }).where(eq(sessions.id, id));
		cookies.set(SESSION_COOKIE, token, cookieOpts(secure, SESSION_DAYS));
	}
	return { user: row.u, sessionId: id };
}

export async function destroySession(cookies: Cookies, sessionId: string | null) {
	if (sessionId) await db.delete(sessions).where(eq(sessions.id, sessionId));
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function purgeSessions() {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString()));
}

/** Alle anderen Geräte abmelden */
export async function destroyOtherSessions(userId: number, keep: string) {
	const all = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
	for (const s of all) if (s.id !== keep) await db.delete(sessions).where(and(eq(sessions.id, s.id), eq(sessions.userId, userId)));
}

/* ------------------------------------------------------------------ Zwischenschritt Passwort → Code */

let pendingKey: Buffer | null = null;
const pendingSecret = () => (pendingKey ??= Buffer.from(hkdfSync('sha256', randomBytes(32), 'astronox', 'anmeldung', 32)));

export function setPending(cookies: Cookies, userId: number, secure: boolean) {
	const exp = Date.now() + 5 * 60_000;
	const payload = `${userId}.${exp}`;
	const sig = createHmac('sha256', pendingSecret()).update(payload).digest('base64url');
	cookies.set(PENDING_COOKIE, `${payload}.${sig}`, { path: '/', httpOnly: true, sameSite: 'strict', secure, maxAge: 300 });
}

export function getPending(cookies: Cookies): number | null {
	const v = cookies.get(PENDING_COOKIE);
	const m = v && /^(\d+)\.(\d+)\.([\w-]+)$/.exec(v);
	if (!m || Number(m[2]) < Date.now()) return null;
	const expected = createHmac('sha256', pendingSecret()).update(`${m[1]}.${m[2]}`).digest();
	const given = Buffer.from(m[3], 'base64url');
	return given.length === expected.length && timingSafeEqual(given, expected) ? Number(m[1]) : null;
}

export const clearPending = (cookies: Cookies) => cookies.delete(PENDING_COOKIE, { path: '/' });

/* ------------------------------------------------------------------ Zweiter Faktor */

export async function checkSecondFactor(user: User, input: string): Promise<'code' | 'notfall' | null> {
	const code = input.trim();
	const secret = decrypt(user.totpSecret);
	if (secret && verifyCode(secret, code)) return 'code';
	// Notfallcode: einmal verwendbar
	const hashes: string[] = JSON.parse(user.recoveryCodes || '[]');
	const h = sha256(code.toLowerCase().replace(/[^a-z0-9]/g, ''));
	if (hashes.includes(h)) {
		await db
			.update(users)
			.set({ recoveryCodes: JSON.stringify(hashes.filter((x) => x !== h)) })
			.where(eq(users.id, user.id));
		return 'notfall';
	}
	return null;
}

/** Zehn neue Notfallcodes – nur einmal im Klartext sichtbar */
export async function newRecoveryCodes(userId: number): Promise<string[]> {
	const codes = Array.from({ length: 10 }, () => {
		const s = randomBytes(8).toString('hex').slice(0, 10);
		return `${s.slice(0, 5)}-${s.slice(5)}`;
	});
	await db
		.update(users)
		.set({ recoveryCodes: JSON.stringify(codes.map((c) => sha256(c.replace('-', '')))) })
		.where(eq(users.id, userId));
	return codes;
}

export async function enableTotp(userId: number, secret: string) {
	await db.update(users).set({ totpSecret: encrypt(secret), totpEnabled: true }).where(eq(users.id, userId));
}

/* ------------------------------------------------------------------ Bremse gegen Durchprobieren */

const attempts = new Map<string, { n: number; start: number }>();
const WINDOW = 15 * 60_000;

export function tooManyAttempts(key: string, limit = 8): boolean {
	const e = attempts.get(key);
	if (!e || Date.now() - e.start > WINDOW) return false;
	return e.n >= limit;
}

export function failedAttempt(key: string) {
	const e = attempts.get(key);
	if (!e || Date.now() - e.start > WINDOW) attempts.set(key, { n: 1, start: Date.now() });
	else e.n++;
	if (attempts.size > 5000) attempts.clear();
}

export const resetAttempts = (key: string) => attempts.delete(key);

/* ------------------------------------------------------------------ Ersteinrichtung */

/** Wird beim Start ins Protokoll geschrieben, solange es noch kein Konto gibt */
export const setupCode = randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})(.{5})/, '$1-$2');

export async function hasUser(): Promise<boolean> {
	const [u] = await db.select({ id: users.id }).from(users).limit(1);
	return !!u;
}
