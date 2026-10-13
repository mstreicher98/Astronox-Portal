import { db } from './db';
import { activities, notifications } from './db/schema';
import { sendPush } from './push';

/** Verlauf bei Kunde und Projekt */
export async function logActivity(a: {
	customerId?: number | null;
	projectId?: number | null;
	kind: string;
	title: string;
	body?: string | null;
	meta?: Record<string, unknown>;
}) {
	await db.insert(activities).values({
		customerId: a.customerId ?? null,
		projectId: a.projectId ?? null,
		kind: a.kind,
		title: a.title.slice(0, 300),
		body: a.body?.slice(0, 20_000) ?? null,
		meta: a.meta ? JSON.stringify(a.meta) : null
	});
}

/** Hinweis im Portal (Glocke) und – wenn gewünscht – Push aufs Handy */
export async function notify(n: { kind: string; title: string; body?: string; url?: string; push?: boolean }) {
	await db.insert(notifications).values({ kind: n.kind, title: n.title.slice(0, 300), body: n.body?.slice(0, 1000) ?? null, url: n.url ?? null });
	if (n.push !== false) {
		try {
			await sendPush({ title: n.title, body: n.body, url: n.url, tag: n.kind });
		} catch (err) {
			console.error('[push]', err);
		}
	}
}
