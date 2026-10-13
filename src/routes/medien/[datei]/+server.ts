import fs from 'node:fs/promises';
import path from 'node:path';
import { error } from '@sveltejs/kit';
import { MEDIA_DIR } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Bilder der Webseite auch im Portal anzeigen (gleicher Ordner wie bei astronox.dev/medien) */
export const GET: RequestHandler = async ({ params }) => {
	const m = /^[\w-]{1,120}\.(webp|avif|jpg|png)$/.exec(params.datei);
	if (!m) error(404, 'Nicht gefunden');
	try {
		const body = await fs.readFile(path.join(MEDIA_DIR, params.datei));
		return new Response(new Uint8Array(body), { headers: { 'content-type': `image/${m[1] === 'jpg' ? 'jpeg' : m[1]}`, 'cache-control': 'private, max-age=31536000, immutable' } });
	} catch {
		error(404, 'Nicht gefunden');
	}
};
