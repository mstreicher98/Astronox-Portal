import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { passkeys, vaultDevices } from '$lib/server/db/schema';
import { body, requireVault, sealed } from '$lib/server/tresor';
import type { RequestHandler } from './$types';

const B64 = /^[A-Za-z0-9+/]{22}==$/;

/**
 * Tresor mit Fingerabdruck entsperren: der Browser schickt den Tresor-Schlüssel, verpackt mit
 * dem PRF-Geheimnis des Passkeys. Ohne den Passkey kann ihn niemand auspacken – auch der Server nicht.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const b = await body(request);
	const id = typeof b?.id === 'string' ? b.id : '';
	const salt = typeof b?.salt === 'string' && B64.test(b.salt) ? b.salt : error(400, 'Salz ist ungültig.');
	const wrapped = sealed(b);
	await requireVault(userId);
	const r = await db
		.update(passkeys)
		.set({ prfSalt: salt, vaultIv: wrapped.iv, vaultKey: wrapped.data })
		.where(and(eq(passkeys.id, id), eq(passkeys.userId, userId)))
		.returning({ id: passkeys.id });
	if (!r.length) error(404, 'Diesen Passkey gibt es nicht.');
	return json({ ok: true });
};

/** Entsperren mit Fingerabdruck ausschalten – für alle Passkeys und Geräte */
export const DELETE: RequestHandler = async ({ locals }) => {
	const userId = locals.user!.id;
	await db.batch([
		db.update(passkeys).set({ prfSalt: null, vaultIv: null, vaultKey: null }).where(eq(passkeys.userId, userId)),
		db.delete(vaultDevices).where(eq(vaultDevices.userId, userId))
	]);
	return json({ ok: true });
};
