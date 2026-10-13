import { error, json } from '@sveltejs/kit';
import { STAGE_IDS, type StageId } from '$lib/shared/stages';
import { moveProject } from '$lib/server/projects';
import type { RequestHandler } from './$types';

/** Karte im Board verschieben */
export const POST: RequestHandler = async ({ request }) => {
	const b = (await request.json().catch(() => ({}))) as { id?: number; stage?: string; beforeId?: number | null; afterId?: number | null };
	if (!b.id || !STAGE_IDS.includes(b.stage as StageId)) error(400, 'Ungültige Angaben');
	await moveProject(Number(b.id), b.stage as StageId, { beforeId: b.beforeId, afterId: b.afterId });
	return json({ ok: true });
};
