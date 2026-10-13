import tls from 'node:tls';
import { desc, eq, gte, lt, sql } from 'drizzle-orm';
import { duration } from '$lib/shared/format';
import { logActivity, notify } from './activity';
import { db } from './db';
import { monitorChecks, monitors, type Monitor } from './db/schema';

/**
 * Erreichbarkeit der Kundenseiten: Abruf alle paar Minuten, Ablaufdatum des
 * Zertifikats alle sechs Stunden. Alarm erst nach zwei Fehlversuchen in Folge,
 * damit ein kurzer Aussetzer keinen Fehlalarm auslöst.
 */

const sslCheckedAt = new Map<number, number>();

function certificateExpiry(url: URL): Promise<string | null> {
	return new Promise((resolve) => {
		const socket = tls.connect({ host: url.hostname, port: Number(url.port) || 443, servername: url.hostname, timeout: 10_000 }, () => {
			const cert = socket.getPeerCertificate();
			socket.end();
			resolve(cert?.valid_to ? new Date(cert.valid_to).toISOString() : null);
		});
		socket.on('error', () => resolve(null));
		socket.on('timeout', () => {
			socket.destroy();
			resolve(null);
		});
	});
}

export async function checkMonitor(m: Monitor): Promise<{ ok: boolean; statusCode: number | null; ms: number | null; error: string | null }> {
	const started = performance.now();
	let ok = false;
	let statusCode: number | null = null;
	let error: string | null = null;
	let ms: number | null = null;
	try {
		const res = await fetch(m.url, {
			redirect: 'follow',
			signal: AbortSignal.timeout(15_000),
			headers: { 'user-agent': 'AstronoxPortal-Monitor/1.0 (+https://astronox.dev)' }
		});
		statusCode = res.status;
		const body = m.keyword ? await res.text() : (await res.arrayBuffer(), '');
		ms = Math.round(performance.now() - started);
		ok = res.status < 400;
		if (!ok) error = `HTTP ${res.status}`;
		else if (m.keyword && !body.includes(m.keyword)) {
			ok = false;
			error = `Text „${m.keyword}“ nicht gefunden`;
		}
	} catch (err) {
		const e = err as Error & { cause?: { code?: string } };
		error = e.name === 'TimeoutError' ? 'Keine Antwort nach 15 Sekunden' : e.cause?.code || e.message;
	}

	let sslExpiresAt = m.sslExpiresAt;
	const url = new URL(m.url);
	if (url.protocol === 'https:' && Date.now() - (sslCheckedAt.get(m.id) ?? 0) > 6 * 3_600_000) {
		sslExpiresAt = (await certificateExpiry(url)) ?? sslExpiresAt;
		sslCheckedAt.set(m.id, Date.now());
	}

	const nowIso = new Date().toISOString();
	await db.insert(monitorChecks).values({ monitorId: m.id, at: nowIso, ok, statusCode, responseMs: ms, error });

	const failures = ok ? 0 : m.failures + 1;
	let status = m.status;
	let downSince = m.downSince;
	if (ok) {
		if (m.status === 'offline' && m.downSince) {
			const mins = (Date.now() - Date.parse(m.downSince)) / 60_000;
			await notify({ kind: 'monitor', title: `Wieder online: ${m.name}`, body: `Nach ${duration(mins)} wieder erreichbar`, url: '/hosting' });
			await logActivity({ customerId: m.customerId, projectId: m.projectId, kind: 'system', title: `${m.name} wieder erreichbar (Ausfall ${duration(mins)})` });
		}
		status = 'online';
		downSince = null;
	} else if (failures >= 2 && m.status !== 'offline') {
		status = 'offline';
		downSince = m.downSince ?? nowIso;
		await notify({ kind: 'monitor', title: `Nicht erreichbar: ${m.name}`, body: error ?? 'Fehler', url: '/hosting' });
		await logActivity({ customerId: m.customerId, projectId: m.projectId, kind: 'system', title: `${m.name} nicht erreichbar`, body: error });
	} else if (!ok && !m.downSince) {
		downSince = nowIso;
	}

	await db
		.update(monitors)
		.set({ status, downSince, failures, lastCheckedAt: nowIso, lastResponseMs: ms, lastStatusCode: statusCode, lastError: error, sslExpiresAt })
		.where(eq(monitors.id, m.id));
	return { ok, statusCode, ms, error };
}

let running = false;

/** Alle fälligen Prüfungen – wird jede halbe Minute aufgerufen */
export async function runMonitors() {
	if (running) return;
	running = true;
	try {
		const all = await db.select().from(monitors).where(eq(monitors.enabled, true));
		const due = all.filter((m) => !m.lastCheckedAt || Date.now() - Date.parse(m.lastCheckedAt) >= m.intervalMin * 60_000 - 5_000);
		// höchstens vier gleichzeitig
		for (let i = 0; i < due.length; i += 4) {
			await Promise.all(due.slice(i, i + 4).map((m) => checkMonitor(m).catch((err) => console.error('[monitor]', m.url, err))));
		}
	} finally {
		running = false;
	}
}

export async function purgeChecks(days = 30) {
	await db.delete(monitorChecks).where(lt(monitorChecks.at, new Date(Date.now() - days * 86_400_000).toISOString()));
}

/** Verfügbarkeit in Prozent und mittlere Antwortzeit je Überwachung über die letzten Tage */
export async function uptimes(days = 30): Promise<Map<number, { pct: number; avgMs: number | null }>> {
	const since = new Date(Date.now() - days * 86_400_000).toISOString();
	const rows = await db
		.select({
			id: monitorChecks.monitorId,
			total: sql<number>`count(*)`,
			ok: sql<number>`sum(${monitorChecks.ok})`,
			avg: sql<number | null>`avg(${monitorChecks.responseMs})`
		})
		.from(monitorChecks)
		.where(gte(monitorChecks.at, since))
		.groupBy(monitorChecks.monitorId);
	return new Map(rows.map((r) => [r.id, { pct: (Number(r.ok) / Number(r.total)) * 100, avgMs: r.avg == null ? null : Math.round(Number(r.avg)) }]));
}

/** Die letzten Prüfungen einer Überwachung für den Verlauf (neueste zuletzt) */
export async function recentChecks(monitorId: number, limit = 60) {
	const rows = await db
		.select({ at: monitorChecks.at, ok: monitorChecks.ok, ms: monitorChecks.responseMs, error: monitorChecks.error })
		.from(monitorChecks)
		.where(eq(monitorChecks.monitorId, monitorId))
		.orderBy(desc(monitorChecks.at))
		.limit(limit);
	return rows.reverse();
}
