import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { vaultItems } from '$lib/server/db/schema';
import { body, requireVault, sealed } from '$lib/server/tresor';
import type { RequestHandler } from './$types';

/** Neuer Eintrag – kommt schon verschlüsselt an */
export const POST: RequestHandler = async ({ request, locals }) => {
	const userId = locals.user!.id;
	const item = sealed(await body(request));
	await requireVault(userId);
	const [row] = await db
		.insert(vaultItems)
		.values({ userId, ...item })
		.returning({ id: vaultItems.id });
	return json({ id: row.id });
};
