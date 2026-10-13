import { defineConfig } from 'drizzle-kit';

/**
 * Nur die Tabellen des Portals. Die Tabellen der Webseite (Anfragen, Termine,
 * Inhalte, Einstellungen …) legt die Webseite selbst an – siehe src/lib/server/db/site.ts.
 */
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: `file:${process.env.DATA_DIR ?? '../astronox-development/data'}/astronox.db`
	}
});
