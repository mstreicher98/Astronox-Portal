import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { env } from '$env/dynamic/private';
import * as portal from './schema';
import * as site from './site';

export const DATA_DIR = path.resolve(env.DATA_DIR || 'data');
export const DB_FILE = path.join(DATA_DIR, 'astronox.db');
/** Bilder für die Webseite – die Webseite liefert sie unter /medien/… aus */
export const MEDIA_DIR = path.join(DATA_DIR, 'medien');
/** Ablage des Portals: Dateien, Mail-Anhänge, festgeschriebene PDFs */
export const PORTAL_DIR = path.join(DATA_DIR, 'portal');
export const FILES_DIR = path.join(PORTAL_DIR, 'dateien');
export const DOCS_DIR = path.join(PORTAL_DIR, 'belege');
export const BACKUP_DIR = path.join(DATA_DIR, 'sicherungen');

for (const dir of [DATA_DIR, MEDIA_DIR, FILES_DIR, DOCS_DIR, BACKUP_DIR]) fs.mkdirSync(dir, { recursive: true });

// Gleiche Datei wie die Webseite. timeout: so lange wird gewartet, wenn die andere App gerade schreibt.
export const client = createClient({ url: `file:${DB_FILE}`, timeout: 8000 });
export const db = drizzle(client, { schema: { ...site, ...portal } });

export type Db = typeof db;

let ready: Promise<void> | null = null;

function migrationsPath(): string {
	const candidates = [path.resolve('drizzle'), path.resolve(process.cwd(), 'drizzle')];
	for (const c of candidates) if (fs.existsSync(path.join(c, 'meta', '_journal.json'))) return c;
	throw new Error('Migrationsordner "drizzle" nicht gefunden');
}

/** Die Webseite legt ihre Tabellen selbst an – bis dahin warten (im Stack startet sie zuerst) */
async function waitForWebsite() {
	for (let i = 0; ; i++) {
		const r = await client.execute("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('site_content', 'settings', 'inquiries', 'bookings')");
		if (Number(r.rows[0].n) === 4) return;
		if (i === 0) console.warn('[db] Warte auf die Tabellen der Webseite – läuft der Dienst „web“?');
		if (i > 120) throw new Error('Die Tabellen der Webseite fehlen. Bitte zuerst die Webseite starten (gleiches Daten-Volume).');
		await new Promise((r) => setTimeout(r, 1000));
	}
}

export function ensureDatabase(): Promise<void> {
	ready ??= (async () => {
		await client.execute('PRAGMA journal_mode = WAL');
		await waitForWebsite();
		// Eigene Migrationsliste, damit sich Webseite und Portal nicht in die Quere kommen
		await migrate(db, { migrationsFolder: migrationsPath(), migrationsTable: '__portal_migrations' });
	})();
	ready.catch(() => (ready = null));
	return ready;
}
