import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { credentials } from '$lib/server/db/schema';
import { decrypt } from '$lib/server/secret';
import type { RequestHandler } from './$types';

/** Zugangsdaten entschlüsselt anzeigen – nur auf Klick, nie im Seiten-HTML */
export const GET: RequestHandler = async ({ params, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	const [c] = await db.select().from(credentials).where(eq(credentials.id, Number(params.id)));
	if (!c) error(404, 'Zugang nicht gefunden');
	return json({ secret: decrypt(c.secret), notes: decrypt(c.notes) });
};
