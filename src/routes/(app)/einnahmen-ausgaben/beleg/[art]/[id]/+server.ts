import fs from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { assets, ledgerEntries } from '$lib/server/db/schema';
import { receiptPath } from '$lib/server/ear';
import type { RequestHandler } from './$types';

/** Beleg einer Buchung oder Anlage – Fotos und PDFs im Browser, sonst als Download */
export const GET: RequestHandler = async ({ params, url }) => {
	const id = Number(params.id);
	const table = params.art === 'anlage' ? assets : ledgerEntries;
	const [row] = await db
		.select({ file: table.receiptFile, name: table.receiptName, mime: table.receiptMime })
		.from(table)
		.where(eq(table.id, id));
	if (!row?.file) error(404, 'Kein Beleg vorhanden.');
	let body: Buffer;
	try {
		body = await fs.readFile(receiptPath(row.file));
	} catch {
		error(404, 'Der Beleg fehlt im Speicher.');
	}
	const mime = row.mime ?? 'application/octet-stream';
	const inline = !url.searchParams.has('download') && (/^image\/(png|jpe?g|webp|gif|avif|heic)$/.test(mime) || mime === 'application/pdf');
	return new Response(new Uint8Array(body), {
		headers: {
			'content-type': inline ? mime : 'application/octet-stream',
			'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.name ?? 'beleg')}`,
			'cache-control': 'private, max-age=3600',
			// hochgeladene Dateien nie als Seite ausführen (der PDF-Betrachter verträgt keine Sandbox)
			...(mime === 'application/pdf' ? {} : { 'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" })
		}
	});
};
