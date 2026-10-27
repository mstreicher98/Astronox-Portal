import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { createSession, failedAttempt, resetAttempts, tooManyAttempts } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { passkeys, users } from '$lib/server/db/schema';
import { loginOptions, relyingParty, verifyLogin } from '$lib/server/passkeys';
import { safeTarget } from '$lib/server/target';
import type { RequestHandler } from './$types';

/**
 * Anmelden mit Fingerabdruck oder Gesicht – ohne Anmeldung erreichbar (hooks.server.ts).
 * Ein Passkey mit Fingerabdruck ist schon zwei Faktoren: Gerät und Finger.
 */
export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	if (tooManyAttempts(`ip:${ip}`)) error(429, 'Zu viele Versuche. Bitte in 15 Minuten noch einmal.');
	const body = (await request.json().catch(() => null)) as { schritt?: string; response?: { id?: unknown }; ziel?: string } | null;
	const rp = relyingParty(url);

	if (body?.schritt === 'optionen') return json(await loginOptions(rp));

	if (body?.schritt === 'pruefen' && typeof body.response?.id === 'string') {
		const [row] = await db.select({ p: passkeys, u: users }).from(passkeys).innerJoin(users, eq(users.id, passkeys.userId)).where(eq(passkeys.id, body.response.id));
		const ok = row && (await verifyLogin(rp, body.response as never, { ...row.p, transports: JSON.parse(row.p.transports) }).catch(() => null));
		if (!row || !ok) {
			failedAttempt(`ip:${ip}`);
			error(400, 'Dieser Passkey ist hier nicht (mehr) eingerichtet. Bitte mit Passwort anmelden.');
		}
		resetAttempts(`ip:${ip}`);
		await db.update(passkeys).set({ counter: ok.counter, lastUsedAt: new Date().toISOString() }).where(eq(passkeys.id, row.p.id));
		await createSession(cookies, row.u.id, request.headers.get('user-agent'), url.protocol === 'https:');
		return json({ ziel: safeTarget(body.ziel ?? null) });
	}

	error(400, 'Unbekannter Schritt.');
};
