import { and, asc, eq, gt, lt, ne } from 'drizzle-orm';
import { STAGE_IDS, stageOf, type StageId } from '$lib/shared/stages';
import { logActivity } from './activity';
import { db } from './db';
import { projects } from './db/schema';
import { inquiries } from './db/site';

/** Status der Anfrage auf der Webseite passend zur Phase im Portal */
function inquiryStatus(stage: StageId): 'neu' | 'in_bearbeitung' | 'erledigt' {
	if (stage === 'anfrage') return 'neu';
	if (stage === 'abgeschlossen' || stage === 'verloren') return 'erledigt';
	return 'in_bearbeitung';
}

/**
 * Projekt in eine Phase verschieben. `beforeId`/`afterId` sind die Nachbarn in
 * der Zielspalte (vom Board); ohne Angabe kommt die Karte ans Ende.
 */
export async function moveProject(id: number, stage: StageId, neighbours: { beforeId?: number | null; afterId?: number | null } = {}, reason?: string | null) {
	if (!STAGE_IDS.includes(stage)) throw new Error('Unbekannte Phase');
	const [p] = await db.select().from(projects).where(eq(projects.id, id));
	if (!p) throw new Error('Projekt nicht gefunden');

	// Position zwischen den Nachbarn
	const posOf = async (pid: number | null | undefined) => {
		if (!pid) return null;
		const [r] = await db.select({ p: projects.position }).from(projects).where(eq(projects.id, pid));
		return r?.p ?? null;
	};
	const above = await posOf(neighbours.beforeId);
	const below = await posOf(neighbours.afterId);
	let position: number;
	if (above != null && below != null) position = (above + below) / 2;
	else if (above != null) {
		const [next] = await db
			.select({ p: projects.position })
			.from(projects)
			.where(and(eq(projects.stage, stage), gt(projects.position, above), ne(projects.id, id)))
			.orderBy(asc(projects.position))
			.limit(1);
		position = next ? (above + next.p) / 2 : above + 1;
	} else if (below != null) {
		const [prev] = await db
			.select({ p: projects.position })
			.from(projects)
			.where(and(eq(projects.stage, stage), lt(projects.position, below), ne(projects.id, id)))
			.orderBy(asc(projects.position))
			.limit(1);
		position = prev ? (prev.p + below) / 2 : below - 1;
	} else {
		const rows = await db.select({ p: projects.position }).from(projects).where(and(eq(projects.stage, stage), ne(projects.id, id)));
		position = rows.length ? Math.max(...rows.map((r) => r.p)) + 1 : 0;
	}

	const now = new Date().toISOString();
	const changed = p.stage !== stage;
	await db
		.update(projects)
		.set({
			stage,
			position,
			updatedAt: now,
			...(changed
				? {
						stageChangedAt: now,
						closedAt: stage === 'abgeschlossen' || stage === 'verloren' ? now : null,
						lostReason: stage === 'verloren' ? (reason ?? p.lostReason) : null
					}
				: {})
		})
		.where(eq(projects.id, id));

	if (changed) {
		await logActivity({
			customerId: p.customerId,
			projectId: id,
			kind: 'phase',
			title: `Phase: ${stageOf(p.stage).label} → ${stageOf(stage).label}`,
			body: stage === 'verloren' ? reason : null
		});
		if (p.inquiryId) {
			await db.update(inquiries).set({ status: inquiryStatus(stage) }).where(eq(inquiries.id, p.inquiryId));
		}
	}
}

/** Nach Angebot/Annahme die Phase nachziehen, aber nie zurück */
export async function advanceTo(projectId: number | null | undefined, stage: StageId) {
	if (!projectId) return;
	const [p] = await db.select({ stage: projects.stage }).from(projects).where(eq(projects.id, projectId));
	if (!p || p.stage === 'verloren') return;
	if (STAGE_IDS.indexOf(p.stage) < STAGE_IDS.indexOf(stage)) await moveProject(projectId, stage);
}
