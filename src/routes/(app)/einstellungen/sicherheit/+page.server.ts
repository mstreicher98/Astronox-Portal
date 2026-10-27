import QRCode from 'qrcode';
import { and, desc, eq } from 'drizzle-orm';
import { checkSecondFactor, destroyOtherSessions, enableTotp, hashPassword, newRecoveryCodes, passwordProblem, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { passkeys, sessions, users } from '$lib/server/db/schema';
import { act, bad } from '$lib/server/forms';
import { decrypt, encrypt } from '$lib/server/secret';
import { newSecret, otpauthUrl, verifyCode } from '$lib/server/totp';
import type { Actions, PageServerLoad } from './$types';

const PAIR = 'portal_totp_wechsel';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const list = await db.select().from(sessions).where(eq(sessions.userId, user.id)).orderBy(desc(sessions.lastSeenAt));
	const keys = await db.select().from(passkeys).where(eq(passkeys.userId, user.id)).orderBy(desc(passkeys.createdAt));
	return {
		passkeys: keys.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt, vault: !!p.vaultKey })),
		notfall: url.searchParams.has('notfall'),
		recoveryLeft: (JSON.parse(user.recoveryCodes || '[]') as string[]).length,
		sessions: list.map((s) => ({ id: s.id.slice(0, 12), current: s.id === locals.sessionId, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt })),
		email: user.email,
		name: user.name
	};
};

export const actions: Actions = {
	profil: act(async ({ locals }, f) => {
		await db
			.update(users)
			.set({ name: f.req('name', 'deinen Namen', 100), email: f.email('email') ?? bad('Bitte eine E-Mail-Adresse angeben.') })
			.where(eq(users.id, locals.user!.id));
		return { message: 'Gespeichert' };
	}),

	passwort: act(async ({ locals }, f) => {
		const user = locals.user!;
		if (!(await verifyPassword(f.str('current', 200) ?? '', user.passwordHash))) bad('Das aktuelle Passwort stimmt nicht.');
		const next = f.str('next', 200) ?? '';
		const problem = passwordProblem(next);
		if (problem) bad(problem);
		if (next !== f.str('repeat', 200)) bad('Die neuen Passwörter sind nicht gleich.');
		await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
		await destroyOtherSessions(user.id, locals.sessionId!);
		return { message: 'Passwort geändert – andere Geräte wurden abgemeldet' };
	}),

	/** Schritt 1 für ein neues Handy: Passwort bestätigen, QR-Code zeigen */
	koppeln_start: act(async ({ locals, cookies, url }, f) => {
		if (!(await verifyPassword(f.str('current', 200) ?? '', locals.user!.passwordHash))) bad('Das Passwort stimmt nicht.');
		const secret = newSecret();
		cookies.set(PAIR, encrypt(secret), { path: '/einstellungen', httpOnly: true, sameSite: 'strict', secure: url.protocol === 'https:', maxAge: 900 });
		const qr = await QRCode.toString(otpauthUrl(secret, locals.user!.email), { type: 'svg', margin: 1, color: { dark: '#0b1330', light: '#ffffff' } });
		return { qr, secret: secret.replace(/(.{4})/g, '$1 ').trim() };
	}),

	/** Schritt 2: Code aus der neuen App bestätigen */
	koppeln: act(async ({ locals, cookies }, f) => {
		const secret = decrypt(cookies.get(PAIR));
		if (!secret) bad('Bitte noch einmal von vorne beginnen.');
		if (!verifyCode(secret, f.str('code', 10) ?? '')) bad('Der Code stimmt nicht.');
		await enableTotp(locals.user!.id, secret);
		cookies.delete(PAIR, { path: '/einstellungen' });
		await destroyOtherSessions(locals.user!.id, locals.sessionId!);
		return { message: 'Neue Authenticator-App verbunden – die alte gilt nicht mehr' };
	}),

	notfallcodes: act(async ({ locals }, f) => {
		const result = await checkSecondFactor(locals.user!, f.str('code', 20) ?? '');
		if (result !== 'code') bad('Bitte einen aktuellen Code aus der App eingeben.');
		return { codes: await newRecoveryCodes(locals.user!.id) };
	}),

	passkey_loeschen: act(async ({ locals }, f) => {
		const r = await db
			.delete(passkeys)
			.where(and(eq(passkeys.id, f.str('id', 200) ?? ''), eq(passkeys.userId, locals.user!.id)))
			.returning({ id: passkeys.id });
		if (!r.length) bad('Diesen Passkey gibt es nicht mehr.');
		return { message: 'Passkey gelöscht' };
	}),

	abmelden: act(async ({ locals }) => {
		await destroyOtherSessions(locals.user!.id, locals.sessionId!);
		return { message: 'Alle anderen Geräte abgemeldet' };
	})
};
