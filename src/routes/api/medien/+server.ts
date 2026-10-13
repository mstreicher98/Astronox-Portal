import { error, json } from '@sveltejs/kit';
import { FormError } from '$lib/server/forms';
import { mediaUrl, saveWebsiteImage } from '$lib/server/uploads';
import type { RequestHandler } from './$types';

/** Bild für die Webseite hochladen (Referenz 16:10 oder Foto quadratisch) */
export const POST: RequestHandler = async ({ request }) => {
	const fd = await request.formData();
	const file = fd.get('file');
	if (!(file instanceof File) || !file.size) error(400, 'Bitte ein Bild auswählen.');
	try {
		const row = await saveWebsiteImage(file, fd.get('purpose') === 'foto' ? 'foto' : 'referenz');
		return json({ id: row.id, url: mediaUrl(row.file), width: row.width, height: row.height });
	} catch (err) {
		if (err instanceof FormError) error(400, err.message);
		throw err;
	}
};
