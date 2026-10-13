import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/schema';
import { act } from '$lib/server/forms';
import { getSetting, setSetting } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	devices: await db
		.select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, userAgent: pushSubscriptions.userAgent, createdAt: pushSubscriptions.createdAt, lastUsedAt: pushSubscriptions.lastUsedAt })
		.from(pushSubscriptions)
		.orderBy(desc(pushSubscriptions.createdAt)),
	monitor: await getSetting('monitor')
});

export const actions: Actions = {
	geraet_loeschen: act(async (_e, f) => {
		await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, f.id('id') ?? 0));
		return { message: 'Gerät entfernt' };
	}),
	fristen: act(async (_e, f) => {
		await setSetting('monitor', { warnDays: Math.min(90, Math.max(1, f.int('warnDays') ?? 21)) });
		return { message: 'Gespeichert' };
	})
};
