import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { documents } from '$lib/server/db/schema';
import { documentPdf, pdfName } from '$lib/server/documents';
import type { RequestHandler } from './$types';

/** PDF eines Belegs – Entwürfe werden frisch erzeugt (mit Wasserzeichen) */
export const GET: RequestHandler = async ({ params, url }) => {
	const [doc] = await db.select().from(documents).where(eq(documents.id, Number(params.id)));
	if (!doc) error(404, 'Beleg nicht gefunden');
	const pdf = await documentPdf(doc.id);
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="${pdfName(doc)}"`,
			'cache-control': 'no-store'
		}
	});
};
