import { json } from '@sveltejs/kit';
import { eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

const body = async (request: Request) => (await request.json().catch(() => ({}))) as { id?: number };

/** Benachrichtigung(en) als gelesen markieren – ohne id alle */
export const POST: RequestHandler = async ({ request }) => {
	const { id } = await body(request);
	const readAt = new Date().toISOString();
	if (id) await db.update(notifications).set({ readAt }).where(eq(notifications.id, Number(id)));
	else await db.update(notifications).set({ readAt }).where(isNull(notifications.readAt));
	return json({ ok: true });
};

/** Benachrichtigung(en) löschen – ohne id alle */
export const DELETE: RequestHandler = async ({ request }) => {
	const { id } = await body(request);
	if (id) await db.delete(notifications).where(eq(notifications.id, Number(id)));
	else await db.delete(notifications);
	return json({ ok: true });
};
