import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import { sendPush, vapidKeys } from '$lib/server/push';
import type { RequestHandler } from './$types';

/** Öffentlicher Schlüssel für das Abo im Browser */
export const GET: RequestHandler = async () => json({ publicKey: (await vapidKeys()).publicKey });

/** Abo speichern, entfernen oder eine Test-Nachricht schicken */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		action?: 'abo' | 'ende' | 'test';
		subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
	};
	if (body.action === 'test') {
		const n = await sendPush({ title: 'Astronox Portal', body: 'Push funktioniert – so sehen Benachrichtigungen aus.', url: '/' });
		return json({ sent: n });
	}
	const sub = body.subscription;
	if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint)) error(400, 'Ungültiges Abo');
	if (body.action === 'ende') {
		await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
		return json({ ok: true });
	}
	if (!sub.keys?.p256dh || !sub.keys.auth) error(400, 'Ungültiges Abo');
	await db
		.insert(pushSubscriptions)
		.values({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: request.headers.get('user-agent')?.slice(0, 300) })
		.onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
	return json({ ok: true });
};
