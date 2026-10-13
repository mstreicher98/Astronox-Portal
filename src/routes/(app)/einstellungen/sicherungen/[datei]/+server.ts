import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { today } from '$lib/shared/format';
import { backupPath, fullArchive } from '$lib/server/backup';
import type { RequestHandler } from './$types';

/** Download einer Tagessicherung oder des Komplettarchivs */
export const GET: RequestHandler = async ({ params }) => {
	if (params.datei === 'archiv') {
		return new Response(fullArchive(), {
			headers: { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="astronox-archiv-${today()}.tar.gz"`, 'cache-control': 'no-store' }
		});
	}
	const p = backupPath(params.datei);
	if (!p) error(404, 'Sicherung nicht gefunden');
	return new Response(Readable.toWeb(fs.createReadStream(p)) as unknown as ReadableStream, {
		headers: { 'content-type': 'application/vnd.sqlite3', 'content-disposition': `attachment; filename="${params.datei}"`, 'cache-control': 'no-store' }
	});
};
