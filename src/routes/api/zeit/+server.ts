import { error, json } from '@sveltejs/kit';
import { eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects, timeEntries } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Timer starten und stoppen – es läuft immer höchstens einer */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { action?: string; projectId?: number; description?: string; taskId?: number };
	const now = new Date();

	// laufenden Timer beenden (auch vor dem Start eines neuen)
	const [running] = await db.select().from(timeEntries).where(isNull(timeEntries.endedAt)).limit(1);
	let minutes = 0;
	if (running) {
		minutes = Math.max(1, Math.round((now.getTime() - Date.parse(running.startedAt)) / 60_000));
		await db.update(timeEntries).set({ endedAt: now.toISOString(), minutes }).where(eq(timeEntries.id, running.id));
	}

	if (body.action === 'stop') return json({ minutes });
	if (body.action !== 'start') error(400, 'Unbekannte Aktion');

	const [p] = await db.select({ id: projects.id, rate: projects.hourlyRateCents }).from(projects).where(eq(projects.id, Number(body.projectId)));
	if (!p) error(400, 'Bitte ein Projekt wählen.');
	await db.insert(timeEntries).values({
		projectId: p.id,
		taskId: Number(body.taskId) || null,
		description: body.description?.trim().slice(0, 300) || null,
		startedAt: now.toISOString(),
		rateCents: p.rate
	});
	return json({ ok: true, stopped: minutes });
};
