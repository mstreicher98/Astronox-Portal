import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { passkeys, vaultItems, vaults } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

/** Passwörter und Authenticator teilen sich den Tresor – nur Chiffretext, entschlüsselt wird im Browser */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const userId = locals.user!.id;
	const [vault] = await db.select().from(vaults).where(eq(vaults.userId, userId));
	const items = vault
		? await db
				.select({ id: vaultItems.id, iv: vaultItems.iv, data: vaultItems.data, updatedAt: vaultItems.updatedAt })
				.from(vaultItems)
				.where(eq(vaultItems.userId, userId))
				.orderBy(asc(vaultItems.id))
		: [];
	// Passkeys: zum Einschalten alle, zum Entsperren die mit verpacktem Tresor-Schlüssel
	const keys = vault ? await db.select().from(passkeys).where(eq(passkeys.userId, userId)) : [];
	return {
		vault: vault ? { salt: vault.salt, iterations: vault.iterations, check: { iv: vault.checkIv, data: vault.check } } : null,
		items,
		rpId: url.hostname,
		passkeys: {
			ids: keys.map((k) => k.id),
			unlock: keys.flatMap((k) => (k.prfSalt && k.vaultIv && k.vaultKey ? [{ id: k.id, name: k.name, salt: k.prfSalt, iv: k.vaultIv, data: k.vaultKey }] : []))
		}
	};
};
