import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { client, DATA_DIR, BACKUP_DIR, MEDIA_DIR, PORTAL_DIR } from './db';
import { today } from '$lib/shared/format';

/**
 * Sicherungen:
 *  - täglich eine Kopie der Datenbank nach /data/sicherungen (14 Stück bleiben)
 *  - auf Knopfdruck ein Gesamtarchiv (.tar.gz) mit Datenbank, Bildern und Dateien
 * Die Kopie entsteht mit VACUUM INTO und ist damit in sich stimmig, auch wenn
 * Webseite oder Portal gerade schreiben.
 */

const KEEP = 14;

export async function snapshot(target: string) {
	await fsp.rm(target, { force: true });
	await client.execute({ sql: 'VACUUM INTO ?', args: [target] });
}

export async function dailyBackup(): Promise<string> {
	const file = path.join(BACKUP_DIR, `astronox-${today()}.db`);
	await snapshot(file);
	const all = (await fsp.readdir(BACKUP_DIR)).filter((f) => /^astronox-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
	for (const old of all.slice(0, Math.max(0, all.length - KEEP))) await fsp.rm(path.join(BACKUP_DIR, old), { force: true });
	return file;
}

export async function listBackups() {
	const all = (await fsp.readdir(BACKUP_DIR).catch(() => [] as string[])).filter((f) => f.endsWith('.db')).sort().reverse();
	return Promise.all(
		all.map(async (name) => {
			const st = await fsp.stat(path.join(BACKUP_DIR, name));
			return { name, size: st.size, at: st.mtime.toISOString() };
		})
	);
}

export function backupPath(name: string): string | null {
	if (!/^astronox-\d{4}-\d{2}-\d{2}\.db$/.test(name)) return null;
	const p = path.join(BACKUP_DIR, name);
	return fs.existsSync(p) ? p : null;
}

/* ------------------------------------------------------------------ tar.gz ohne Zusatzpaket */

function header(name: string, size: number, mtime: Date): Buffer {
	const h = Buffer.alloc(512);
	let n = name;
	let prefix = '';
	if (Buffer.byteLength(n) > 100) {
		const cut = n.lastIndexOf('/', 154);
		prefix = n.slice(0, cut);
		n = n.slice(cut + 1);
	}
	const put = (s: string, off: number, len: number) => h.write(s, off, len, 'utf8');
	const oct = (v: number, len: number) => v.toString(8).padStart(len - 1, '0') + '\0';
	put(n, 0, 100);
	put(oct(0o644, 8), 100, 8);
	put(oct(1000, 8), 108, 8);
	put(oct(1000, 8), 116, 8);
	put(oct(size, 12), 124, 12);
	put(oct(Math.floor(mtime.getTime() / 1000), 12), 136, 12);
	h.fill(' ', 148, 156);
	put('0', 156, 1);
	put('ustar\0', 257, 6);
	put('00', 263, 2);
	put(prefix, 345, 155);
	let sum = 0;
	for (const b of h) sum += b;
	put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
	return h;
}

async function* walk(dir: string, base: string): AsyncGenerator<{ abs: string; rel: string }> {
	let entries: fs.Dirent[];
	try {
		entries = await fsp.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const e of entries) {
		const abs = path.join(dir, e.name);
		const rel = path.posix.join(base, e.name);
		if (e.isDirectory()) yield* walk(abs, rel);
		else if (e.isFile()) yield { abs, rel };
	}
}

async function* tarEntries(): AsyncGenerator<Buffer> {
	const tmp = path.join(BACKUP_DIR, `.archiv-${Date.now()}.db`);
	await snapshot(tmp);
	try {
		const files: { abs: string; rel: string }[] = [{ abs: tmp, rel: 'astronox.db' }];
		for await (const f of walk(MEDIA_DIR, 'medien')) files.push(f);
		for await (const f of walk(PORTAL_DIR, 'portal')) files.push(f);
		const key = path.join(DATA_DIR, '.schluessel');
		if (fs.existsSync(key)) files.push({ abs: key, rel: '.schluessel' });
		for (const f of files) {
			const st = await fsp.stat(f.abs);
			yield header(f.rel, st.size, st.mtime);
			for await (const chunk of fs.createReadStream(f.abs)) yield chunk as Buffer;
			const pad = (512 - (st.size % 512)) % 512;
			if (pad) yield Buffer.alloc(pad);
		}
		yield Buffer.alloc(1024);
	} finally {
		await fsp.rm(tmp, { force: true });
	}
}

/** Gesamtarchiv als Stream für den Download */
export function fullArchive(): ReadableStream {
	const stream = Readable.from(tarEntries()).pipe(createGzip({ level: 6 }));
	return Readable.toWeb(stream) as unknown as ReadableStream;
}
