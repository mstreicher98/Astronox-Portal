import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { vaultItems } from '$lib/server/db/schema';
import { body, sealed } from '$lib/server/tresor';
import type { RequestHandler } from './$types';

const mine = (id: string, userId: number) => and(eq(vaultItems.id, Number(id)), eq(vaultItems.userId, userId));

/** Eintrag ersetzen – kommt schon verschlüsselt an */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const item = sealed(await body(request));
	const r = await db
		.update(vaultItems)
		.set({ ...item, updatedAt: new Date().toISOString() })
		.where(mine(params.id, locals.user!.id))
		.returning({ id: vaultItems.id });
	if (!r.length) error(404, 'Eintrag nicht gefunden.');
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const r = await db.delete(vaultItems).where(mine(params.id, locals.user!.id)).returning({ id: vaultItems.id });
	if (!r.length) error(404, 'Eintrag nicht gefunden.');
	return json({ ok: true });
};
