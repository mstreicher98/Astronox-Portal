import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { vaultItems, vaults } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

/** Nur Chiffretext – entschlüsselt wird im Browser */
export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const [vault] = await db.select().from(vaults).where(eq(vaults.userId, userId));
	const items = vault
		? await db
				.select({ id: vaultItems.id, iv: vaultItems.iv, data: vaultItems.data, updatedAt: vaultItems.updatedAt })
				.from(vaultItems)
				.where(eq(vaultItems.userId, userId))
				.orderBy(asc(vaultItems.id))
		: [];
	return {
		vault: vault ? { salt: vault.salt, iterations: vault.iterations, check: { iv: vault.checkIv, data: vault.check } } : null,
		items
	};
};
