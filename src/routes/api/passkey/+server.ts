import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { notify } from '$lib/server/activity';
import { failedAttempt, resetAttempts, tooManyAttempts } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { passkeys } from '$lib/server/db/schema';
import { deviceName, registrationOptions, relyingParty, verifyNew } from '$lib/server/passkeys';
import { decrypt } from '$lib/server/secret';
import { verifyCode } from '$lib/server/totp';
import type { RequestHandler } from './$types';

/**
 * Fingerabdruck oder Gesicht einrichten. Verlangt den aktuellen Code aus der
 * Authenticator-App – sonst könnte sich mit einem gestohlenen Cookie jemand dauerhaft einen
 * eigenen Zugang anlegen.
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const user = locals.user!;
	const body = (await request.json().catch(() => null)) as { schritt?: string; code?: string; response?: unknown } | null;
	const rp = relyingParty(url);

	if (body?.schritt === 'optionen') {
		if (tooManyAttempts(`code:${user.id}`, 6)) error(429, 'Zu viele falsche Codes. Bitte in 15 Minuten noch einmal.');
		const secret = decrypt(user.totpSecret);
		if (!secret || !verifyCode(secret, String(body.code ?? ''))) {
			failedAttempt(`code:${user.id}`);
			error(400, 'Der Code aus der Authenticator-App stimmt nicht.');
		}
		resetAttempts(`code:${user.id}`);
		const existing = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, user.id));
		return json(await registrationOptions(rp, user, existing.map((p) => ({ id: p.id, transports: JSON.parse(p.transports) }))));
	}

	if (body?.schritt === 'pruefen') {
		const cred = await verifyNew(rp, user.id, body.response as never).catch(() => null);
		if (!cred) error(400, 'Das Einrichten hat nicht geklappt. Bitte noch einmal versuchen.');
		const name = deviceName(request.headers.get('user-agent'));
		await db.insert(passkeys).values({ id: cred.id, userId: user.id, publicKey: cred.publicKey, counter: cred.counter, transports: JSON.stringify(cred.transports), name, prf: cred.prf });
		await notify({ kind: 'sicherheit', title: 'Neuer Passkey eingerichtet', body: `${name} – Anmeldung mit Fingerabdruck oder Gesicht. Warst du das nicht? Unter Einstellungen → Sicherheit löschen.`, url: '/einstellungen/sicherheit' });
		return json({ ok: true, name, prf: cred.prf });
	}

	error(400, 'Unbekannter Schritt.');
};
