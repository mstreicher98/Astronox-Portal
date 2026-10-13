import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { tasks } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Aufgabe abhaken (Aufgabenliste, Cockpit) */
export const POST: RequestHandler = async ({ request }) => {
	const { id, done } = (await request.json().catch(() => ({}))) as { id?: number; done?: boolean };
	if (!id) error(400, 'Aufgabe fehlt');
	await db
		.update(tasks)
		.set({ doneAt: done ? new Date().toISOString() : null })
		.where(eq(tasks.id, Number(id)));
	return json({ ok: true });
};
