import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { pushSubscriptions } from './db/schema';
import { decrypt, encrypt } from './secret';
import { getSetting, setSetting } from './settings';

/** Push-Nachrichten aufs Handy (Web Push mit VAPID, ohne Fremddienst außer dem Push-Dienst des Browsers) */

let keys: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys() {
	if (keys) return keys;
	const stored = await getSetting('push');
	if (stored.publicKey && decrypt(stored.privateKey)) {
		keys = { publicKey: stored.publicKey, privateKey: decrypt(stored.privateKey) };
	} else {
		const k = webpush.generateVAPIDKeys();
		await setSetting('push', { publicKey: k.publicKey, privateKey: encrypt(k.privateKey) });
		keys = k;
	}
	return keys;
}

export interface PushMessage {
	title: string;
	body?: string;
	url?: string;
	tag?: string;
}

export async function sendPush(msg: PushMessage): Promise<number> {
	const subs = await db.select().from(pushSubscriptions);
	if (!subs.length) return 0;
	const k = await vapidKeys();
	const payload = JSON.stringify(msg);
	let sent = 0;
	await Promise.all(
		subs.map(async (s) => {
			try {
				await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
					vapidDetails: { subject: 'mailto:office@astronox.dev', publicKey: k.publicKey, privateKey: k.privateKey },
					TTL: 60 * 60 * 24,
					urgency: 'high'
				});
				sent++;
				await db.update(pushSubscriptions).set({ lastUsedAt: new Date().toISOString() }).where(eq(pushSubscriptions.id, s.id));
			} catch (err) {
				const status = (err as { statusCode?: number }).statusCode;
				// Abo abgelaufen oder im Browser entfernt
				if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
				else console.error('[push]', status, (err as Error).message);
			}
		})
	);
	return sent;
}
