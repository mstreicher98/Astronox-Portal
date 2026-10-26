import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { vaultItems, vaults } from '$lib/server/db/schema';
import { body, keyParams, sealed } from '$lib/server/tresor';
import type { RequestHandler } from './$types';

/**
 * Tresor einrichten – oder das Master-Passwort ändern: dann kommen alle Einträge
 * neu verschlüsselt mit und werden gemeinsam mit dem neuen Prüfwert gespeichert.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const b = await body(request);
	const { salt, iterations } = keyParams(b);
	const check = sealed(b?.check);
	const [vault] = await db.select({ userId: vaults.userId }).from(vaults).where(eq(vaults.userId, userId));

	if (!vault) {
		await db.insert(vaults).values({ userId, salt, iterations, checkIv: check.iv, check: check.data });
		return json({ ok: true });
	}

	if (!Array.isArray(b?.items)) error(409, 'Der Tresor ist schon eingerichtet.');
	const items = (b.items as unknown[]).map((i) => ({ id: Number((i as { id?: unknown })?.id), ...sealed(i) }));
	const current = new Set((await db.select({ id: vaultItems.id }).from(vaultItems).where(eq(vaultItems.userId, userId))).map((r) => r.id));
	const sent = new Set(items.map((i) => i.id));
	if (sent.size !== items.length || sent.size !== current.size || [...sent].some((id) => !current.has(id))) {
		error(409, 'Die Einträge haben sich inzwischen geändert – bitte die Seite neu laden und noch einmal versuchen.');
	}

	const updatedAt = new Date().toISOString();
	await db.batch([
		db.update(vaults).set({ salt, iterations, checkIv: check.iv, check: check.data, updatedAt }).where(eq(vaults.userId, userId)),
		...items.map((i) => db.update(vaultItems).set({ iv: i.iv, data: i.data }).where(and(eq(vaultItems.id, i.id), eq(vaultItems.userId, userId))))
	]);
	return json({ ok: true });
};

/** Tresor samt Einträgen löschen – der Weg, wenn das Master-Passwort vergessen ist */
export const DELETE: RequestHandler = async ({ locals }) => {
	const userId = locals.user!.id;
	await db.batch([db.delete(vaultItems).where(eq(vaultItems.userId, userId)), db.delete(vaults).where(eq(vaults.userId, userId))]);
	return json({ ok: true });
};
