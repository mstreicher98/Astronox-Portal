import fs from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { filePath } from '$lib/server/uploads';
import type { RequestHandler } from './$types';

/** Datei ausliefern – Bilder und PDFs im Browser, alles andere als Download */
export const GET: RequestHandler = async ({ params, url }) => {
	const [f] = await db.select().from(files).where(eq(files.id, Number(params.id)));
	if (!f) error(404, 'Datei nicht gefunden');
	let body: Buffer;
	try {
		body = await fs.readFile(filePath(f.storedName));
	} catch {
		error(404, 'Die Datei fehlt im Speicher.');
	}
	const inline = !url.searchParams.has('download') && (/^image\/(png|jpe?g|webp|gif|avif)$/.test(f.mime) || f.mime === 'application/pdf');
	return new Response(new Uint8Array(body), {
		headers: {
			'content-type': inline ? f.mime : 'application/octet-stream',
			'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
			'cache-control': 'private, max-age=3600',
			// hochgeladene Dateien nie als Seite ausführen (der PDF-Betrachter verträgt keine Sandbox)
			...(f.mime === 'application/pdf' ? {} : { 'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" })
		}
	});
};
