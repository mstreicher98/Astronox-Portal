import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp, { type OutputInfo } from 'sharp';
import { eq } from 'drizzle-orm';
import { db, FILES_DIR, MEDIA_DIR } from './db';
import { files, media, type MediaRow } from './db/schema';
import { bad } from './forms';

/** Hochgeladene Dateien: Bilder für die Webseite und Dateien zu Kunden und Projekten */

const MAX_FILE = 50 * 1024 * 1024;
const MAX_IMAGE = 25 * 1024 * 1024;

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/\.[^.]+$/, '')
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40) || 'bild';

export type ImagePurpose = 'referenz' | 'foto';

/**
 * Bild für die Webseite: gedreht nach EXIF, zugeschnitten und als WebP gespeichert.
 * Referenzen 16:10 (1600 × 1000), Foto quadratisch (800 × 800).
 */
export async function saveWebsiteImage(file: File, purpose: ImagePurpose): Promise<MediaRow> {
	if (file.size > MAX_IMAGE) bad('Das Bild ist größer als 25 MB.');
	if (!/^image\/(jpeg|png|webp|avif|heic|heif|gif|tiff)$/.test(file.type) && !/\.(jpe?g|png|webp|avif|heic|gif|tiff?)$/i.test(file.name)) {
		bad('Bitte ein Bild hochladen (JPG, PNG, WebP oder AVIF).');
	}
	const input = Buffer.from(await file.arrayBuffer());
	const size = purpose === 'foto' ? { width: 800, height: 800 } : { width: 1600, height: 1000 };
	let out: { data: Buffer; info: OutputInfo };
	try {
		out = await sharp(input, { failOn: 'error' })
			.rotate()
			.resize({ ...size, fit: 'cover', position: sharp.strategy.attention, withoutEnlargement: false })
			.webp({ quality: 82, effort: 5 })
			.toBuffer({ resolveWithObject: true });
	} catch {
		return bad('Dieses Bild lässt sich nicht lesen.');
	}
	const name = `${slug(file.name)}-${randomBytes(4).toString('hex')}.webp`;
	await fs.writeFile(path.join(MEDIA_DIR, name), out.data);
	const [row] = await db
		.insert(media)
		.values({ file: name, originalName: file.name.slice(0, 200), width: out.info.width, height: out.info.height, size: out.data.length })
		.returning();
	return row;
}

export async function deleteMedia(id: number) {
	const [row] = await db.select().from(media).where(eq(media.id, id));
	if (!row) return;
	await fs.rm(path.join(MEDIA_DIR, row.file), { force: true });
	await db.delete(media).where(eq(media.id, id));
}

export const mediaUrl = (file: string) => `/medien/${file}`;

/** Datei zu Kunde oder Projekt */
export async function saveFile(file: File, owner: { customerId?: number | null; projectId?: number | null }) {
	if (file.size > MAX_FILE) bad(`„${file.name}“ ist größer als 50 MB.`);
	const name = file.name.replace(/[/\\]/g, '_').slice(0, 200) || 'datei';
	const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
	const stored = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`;
	await fs.writeFile(path.join(FILES_DIR, stored), Buffer.from(await file.arrayBuffer()));
	const [row] = await db
		.insert(files)
		.values({ customerId: owner.customerId ?? null, projectId: owner.projectId ?? null, name, storedName: stored, mime: file.type || 'application/octet-stream', size: file.size })
		.returning();
	return row;
}

export async function deleteFile(id: number) {
	const [row] = await db.select().from(files).where(eq(files.id, id));
	if (!row) return;
	await fs.rm(path.join(FILES_DIR, row.storedName), { force: true });
	await db.delete(files).where(eq(files.id, id));
}

export const filePath = (storedName: string) => path.join(FILES_DIR, path.basename(storedName));
