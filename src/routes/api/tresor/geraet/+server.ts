import { randomBytes } from 'node:crypto';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { passkeys, vaultDevices } from '$lib/server/db/schema';
import { deviceName, relyingParty, vaultOptions, verifyVault } from '$lib/server/passkeys';
import { body, requireVault, sealed } from '$lib/server/tresor';
import type { RequestHandler } from './$types';

/**
 * Tresor mit Fingerabdruck, wenn der Passwort-Manager kein PRF kann: der Tresor-Schlüssel ist
 * mit einem Schlüssel verpackt, der nur auf dem Gerät liegt. Hier liegt nur dieses Paket – und
 * es geht erst nach geprüftem Passkey (Fingerabdruck, Gesicht) an das Gerät zurück.
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const userId = locals.user!.id;
	const b = await body(request);
	const rp = relyingParty(url);
	const id = typeof b?.id === 'string' && /^[\w-]{22}$/.test(b.id) ? b.id : null;
	const mine = (deviceId: string) => and(eq(vaultDevices.id, deviceId), eq(vaultDevices.userId, userId));

	if (b?.schritt === 'speichern') {
		await requireVault(userId);
		const wrapped = sealed(b);
		const [any] = await db.select({ id: passkeys.id }).from(passkeys).where(eq(passkeys.userId, userId)).limit(1);
		if (!any) error(409, 'Richte zuerst unter Einstellungen → Sicherheit einen Passkey für dieses Gerät ein.');
		const deviceId = randomBytes(16).toString('base64url');
		await db.insert(vaultDevices).values({ id: deviceId, userId, name: deviceName(request.headers.get('user-agent')), iv: wrapped.iv, data: wrapped.data });
		return json({ id: deviceId });
	}

	if (!id) error(400, 'Gerät fehlt.');
	const [device] = await db.select().from(vaultDevices).where(mine(id));
	if (!device) error(404, 'Dieses Gerät ist für den Tresor nicht (mehr) eingeschaltet.');

	if (b?.schritt === 'optionen') {
		const keys = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, userId));
		if (!keys.length) error(409, 'Es ist kein Passkey mehr eingerichtet.');
		return json(await vaultOptions(rp, userId, keys.map((k) => ({ id: k.id, transports: JSON.parse(k.transports) }))));
	}

	if (b?.schritt === 'oeffnen') {
		const response = b.response as { id?: unknown } | undefined;
		const [key] = typeof response?.id === 'string' ? await db.select().from(passkeys).where(and(eq(passkeys.id, response.id), eq(passkeys.userId, userId))) : [];
		const ok = key && (await verifyVault(rp, userId, response as never, { ...key, transports: JSON.parse(key.transports) }).catch(() => null));
		if (!key || !ok) error(403, 'Der Fingerabdruck ließ sich nicht prüfen.');
		const now = new Date().toISOString();
		await db.batch([db.update(passkeys).set({ counter: ok.counter, lastUsedAt: now }).where(eq(passkeys.id, key.id)), db.update(vaultDevices).set({ lastUsedAt: now }).where(mine(id))]);
		return json({ iv: device.iv, data: device.data });
	}

	error(400, 'Unbekannter Schritt.');
};
