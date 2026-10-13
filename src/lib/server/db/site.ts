/**
 * Tabellen der WEBSEITE (Repo Astronox-Development, src/lib/server/db/schema.ts).
 * Die Webseite legt sie an und migriert sie – hier nur gespiegelt, damit das Portal
 * sie lesen und bearbeiten kann. Bei Änderungen dort diese Datei nachziehen.
 */
import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const created = () =>
	text('created_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

/** Über die Webseite gebuchte Erstgespräche. Zeiten in UTC (ISO). */
export const bookings = sqliteTable(
	'bookings',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		startsAt: text('starts_at').notNull(),
		endsAt: text('ends_at').notNull(),
		kind: text('kind', { enum: ['telefon', 'video'] }).notNull(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		phone: text('phone'),
		company: text('company'),
		message: text('message'),
		status: text('status', { enum: ['bestaetigt', 'abgesagt'] })
			.notNull()
			.default('bestaetigt'),
		/** Geheimer Schlüssel für den Absage-Link in der Bestätigung */
		token: text('token').notNull().unique(),
		cancelledAt: text('cancelled_at'),
		createdAt: created()
	},
	(t) => [
		// Ein Zeitfenster kann nur einmal bestätigt vergeben werden
		uniqueIndex('bookings_slot_unique')
			.on(t.startsAt)
			.where(sql`status = 'bestaetigt'`),
		index('bookings_starts_idx').on(t.startsAt)
	]
);

/** Projektanfragen aus dem mehrstufigen Formular */
export const inquiries = sqliteTable('inquiries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	projectType: text('project_type').notNull(),
	budget: text('budget').notNull(),
	timeframe: text('timeframe').notNull(),
	name: text('name').notNull(),
	email: text('email').notNull(),
	phone: text('phone'),
	company: text('company'),
	message: text('message').notNull(),
	status: text('status', { enum: ['neu', 'in_bearbeitung', 'erledigt'] })
		.notNull()
		.default('neu'),
	createdAt: created()
});

/** Besucherzählung: nur Summen je Tag und Pfad – keine IP, kein Cookie */
export const pageViews = sqliteTable(
	'page_views',
	{
		day: text('day').notNull(),
		path: text('path').notNull(),
		views: integer('views').notNull().default(0)
	},
	(t) => [primaryKey({ columns: [t.day, t.path] })]
);

export const mailLog = sqliteTable('mail_log', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	to: text('to').notNull(),
	subject: text('subject').notNull(),
	template: text('template').notNull(),
	status: text('status', { enum: ['gesendet', 'fehler', 'nicht_eingerichtet'] }).notNull(),
	error: text('error'),
	createdAt: created()
});

/**
 * Inhalte der Webseite, bearbeitet im Portal (portal.astronox.dev).
 * Je Abschnitt eine Zeile: veröffentlichte Fassung und optional ein Entwurf,
 * der nur in der Vorschau sichtbar ist. Beide als JSON.
 */
export const siteContent = sqliteTable('site_content', {
	key: text('key').primaryKey(),
	published: text('published').notNull(),
	draft: text('draft'),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	publishedAt: text('published_at')
});

/**
 * Einstellungen als JSON je Schlüssel. Webseite und Portal teilen sich die
 * Tabelle: die Webseite liest „termine“, „anfrage“ und „smtp“, alles andere
 * gehört dem Portal. Passwörter liegen verschlüsselt darin (siehe secret.ts).
 */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
});

export type Booking = typeof bookings.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
