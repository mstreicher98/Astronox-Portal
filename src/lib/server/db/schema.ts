import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { CONTRACT_KIND_IDS, STAGE_IDS } from '../../shared/stages';

export type { StageId } from '../../shared/stages';

/**
 * Tabellen des Portals. Sie liegen in derselben Datenbank wie die der Webseite
 * (/data/astronox.db), haben aber eine eigene Migrationsliste (__portal_migrations).
 * Beträge immer in Cent, Zeitpunkte als ISO-Text in UTC, Tage als „YYYY-MM-DD“.
 */

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const created = () => text('created_at').notNull().default(now);
const updated = () => text('updated_at').notNull().default(now);
const bool = (name: string) => integer(name, { mode: 'boolean' });

/* ------------------------------------------------------------------ Zugang */

export const users = sqliteTable('portal_users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	passwordHash: text('password_hash').notNull(),
	/** verschlüsselt; erst nach Bestätigung aktiv */
	totpSecret: text('totp_secret'),
	totpEnabled: bool('totp_enabled').notNull().default(false),
	/** gehashte Notfallcodes als JSON-Liste */
	recoveryCodes: text('recovery_codes').notNull().default('[]'),
	createdAt: created(),
	lastLoginAt: text('last_login_at')
});

export const sessions = sqliteTable('portal_sessions', {
	/** SHA-256 des Cookie-Werts – der Wert selbst wird nie gespeichert */
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: text('expires_at').notNull(),
	userAgent: text('user_agent'),
	createdAt: created(),
	lastSeenAt: text('last_seen_at').notNull().default(now)
});

/* ------------------------------------------------------------------ Kunden */

export const customers = sqliteTable(
	'customers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kind: text('kind', { enum: ['firma', 'privat'] })
			.notNull()
			.default('firma'),
		name: text('name').notNull(),
		email: text('email'),
		phone: text('phone'),
		website: text('website'),
		street: text('street'),
		zip: text('zip'),
		city: text('city'),
		country: text('country').notNull().default('Österreich'),
		vatId: text('vat_id'),
		notes: text('notes'),
		/** Woher: webseite, termin, empfehlung, manuell … */
		source: text('source').notNull().default('manuell'),
		createdAt: created(),
		updatedAt: updated(),
		archivedAt: text('archived_at')
	},
	(t) => [index('customers_email_idx').on(t.email)]
);

export const contacts = sqliteTable(
	'contacts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		role: text('role'),
		email: text('email'),
		phone: text('phone'),
		isPrimary: bool('is_primary').notNull().default(false),
		createdAt: created()
	},
	(t) => [index('contacts_email_idx').on(t.email), index('contacts_customer_idx').on(t.customerId)]
);

/* ------------------------------------------------------------------ Projekte */

export const projects = sqliteTable(
	'projects',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		kind: text('kind').notNull().default('webseite'),
		stage: text('stage', { enum: STAGE_IDS }).notNull().default('anfrage'),
		/** Reihenfolge innerhalb der Spalte im Board */
		position: real('position').notNull().default(0),
		valueCents: integer('value_cents'),
		budgetLabel: text('budget_label'),
		timeframeLabel: text('timeframe_label'),
		startDate: text('start_date'),
		dueDate: text('due_date'),
		/** leer = Standard-Stundensatz aus den Einstellungen */
		hourlyRateCents: integer('hourly_rate_cents'),
		description: text('description'),
		/** Herkunft von der Webseite */
		inquiryId: integer('inquiry_id'),
		bookingId: integer('booking_id'),
		repoUrl: text('repo_url'),
		liveUrl: text('live_url'),
		stagingUrl: text('staging_url'),
		lostReason: text('lost_reason'),
		stageChangedAt: text('stage_changed_at').notNull().default(now),
		closedAt: text('closed_at'),
		createdAt: created(),
		updatedAt: updated(),
		archivedAt: text('archived_at')
	},
	(t) => [index('projects_stage_idx').on(t.stage, t.position), index('projects_customer_idx').on(t.customerId)]
);

export const milestones = sqliteTable('milestones', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	projectId: integer('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	dueDate: text('due_date'),
	doneAt: text('done_at'),
	position: real('position').notNull().default(0),
	createdAt: created()
});

export const tasks = sqliteTable(
	'tasks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		projectId: integer('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		milestoneId: integer('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		notes: text('notes'),
		dueDate: text('due_date'),
		doneAt: text('done_at'),
		position: real('position').notNull().default(0),
		createdAt: created()
	},
	(t) => [index('tasks_project_idx').on(t.projectId), index('tasks_due_idx').on(t.dueDate)]
);

export const checklistTemplates = sqliteTable('checklist_templates', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/** JSON-Liste von Aufgabentiteln */
	items: text('items').notNull().default('[]'),
	createdAt: created()
});

export const timeEntries = sqliteTable(
	'time_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		projectId: integer('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
		description: text('description'),
		startedAt: text('started_at').notNull(),
		/** leer = Timer läuft */
		endedAt: text('ended_at'),
		minutes: integer('minutes').notNull().default(0),
		billable: bool('billable').notNull().default(true),
		rateCents: integer('rate_cents'),
		/** abgerechnet mit dieser Rechnung */
		invoiceId: integer('invoice_id').references((): AnySQLiteColumn => documents.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [index('time_project_idx').on(t.projectId, t.startedAt), index('time_started_idx').on(t.startedAt)]
);

/* ------------------------------------------------------------------ Dateien, Zugänge, Verlauf */

export const files = sqliteTable(
	'files',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
		projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		/** Dateiname unter /data/portal/dateien */
		storedName: text('stored_name').notNull().unique(),
		mime: text('mime').notNull(),
		size: integer('size').notNull(),
		source: text('source', { enum: ['upload', 'mail'] })
			.notNull()
			.default('upload'),
		mailId: integer('mail_id'),
		createdAt: created()
	},
	(t) => [index('files_project_idx').on(t.projectId), index('files_customer_idx').on(t.customerId)]
);

export const credentials = sqliteTable('credentials', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
	projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
	label: text('label').notNull(),
	url: text('url'),
	username: text('username'),
	/** verschlüsselt */
	secret: text('secret'),
	/** verschlüsselt */
	notes: text('notes'),
	createdAt: created(),
	updatedAt: updated()
});

export const activities = sqliteTable(
	'activities',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
		projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
		/** notiz, anruf, phase, anfrage, termin, mail_ein, mail_aus, angebot, rechnung, datei, zahlung, system */
		kind: text('kind').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		/** JSON mit Verweisen (mailId, documentId …) */
		meta: text('meta'),
		createdAt: created()
	},
	(t) => [index('activities_customer_idx').on(t.customerId, t.createdAt), index('activities_project_idx').on(t.projectId, t.createdAt)]
);

/* ------------------------------------------------------------------ Hosting & Wartung */

/**
 * Hosting-, Wartungs- und Supportverträge. Abgerechnet wird im Voraus am
 * Monatsersten; ein Beginn mitten im Monat wird anteilig berechnet (shared/billing.ts).
 */
export const contracts = sqliteTable('contracts', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	customerId: integer('customer_id')
		.notNull()
		.references(() => customers.id, { onDelete: 'restrict' }),
	projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
	kind: text('kind', { enum: CONTRACT_KIND_IDS }).notNull().default('hosting'),
	title: text('title').notNull(),
	/** interne Notiz – was auf der Rechnung steht, kommt aus den Positionen */
	description: text('description'),
	/** Summe der Positionen je Abrechnungszeitraum (netto) – wird beim Speichern berechnet */
	amountCents: integer('amount_cents').notNull(),
	interval: text('interval', { enum: ['monat', 'quartal', 'halbjahr', 'jahr'] })
		.notNull()
		.default('monat'),
	startDate: text('start_date').notNull(),
	/** letzter Tag des Vertrags (bei Kündigung) */
	endDate: text('end_date'),
	/** nächster Abrechnungszeitraum beginnt an diesem Tag */
	nextInvoiceDate: text('next_invoice_date').notNull(),
	/** Rechnungen automatisch anlegen */
	autoInvoice: bool('auto_invoice').notNull().default(true),
	/** zusätzlich festschreiben und per E-Mail an den Kunden senden (sonst bleibt es beim Entwurf) */
	autoSend: bool('auto_send').notNull().default(false),
	/** Mindestlaufzeit in Monaten ab Beginn */
	minTermMonths: integer('min_term_months'),
	/** Kündigungsfrist in Monaten, jeweils zum Monatsende */
	noticeMonths: integer('notice_months'),
	/** Kündigung eingegangen am */
	cancelledOn: text('cancelled_on'),
	active: bool('active').notNull().default(true),
	createdAt: created(),
	updatedAt: updated()
});

/** Positionen eines Vertrags – erscheinen so auf jeder Rechnung */
export const contractItems = sqliteTable(
	'contract_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		contractId: integer('contract_id')
			.notNull()
			.references(() => contracts.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0),
		title: text('title').notNull(),
		description: text('description'),
		quantity: real('quantity').notNull().default(1),
		unit: text('unit').notNull().default('Pauschale'),
		/** Preis je Abrechnungszeitraum (netto) */
		unitPriceCents: integer('unit_price_cents').notNull().default(0)
	},
	(t) => [index('contract_items_contract_idx').on(t.contractId)]
);

/** Welcher Zeitraum eines Vertrags mit welcher Rechnung abgerechnet wurde */
export const contractBillings = sqliteTable(
	'contract_billings',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		contractId: integer('contract_id')
			.notNull()
			.references(() => contracts.id, { onDelete: 'cascade' }),
		documentId: integer('document_id').references((): AnySQLiteColumn => documents.id, { onDelete: 'set null' }),
		periodFrom: text('period_from').notNull(),
		periodTo: text('period_to').notNull(),
		amountCents: integer('amount_cents').notNull(),
		createdAt: created()
	},
	(t) => [index('contract_billings_contract_idx').on(t.contractId, t.periodFrom)]
);

export const domains = sqliteTable('domains', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
	projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	registrar: text('registrar'),
	expiresOn: text('expires_on'),
	autoRenew: bool('auto_renew').notNull().default(true),
	notes: text('notes'),
	createdAt: created()
});

export const monitors = sqliteTable('monitors', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
	projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	url: text('url').notNull(),
	/** optional: dieser Text muss auf der Seite vorkommen */
	keyword: text('keyword'),
	intervalMin: integer('interval_min').notNull().default(5),
	enabled: bool('enabled').notNull().default(true),
	status: text('status', { enum: ['unbekannt', 'online', 'offline'] })
		.notNull()
		.default('unbekannt'),
	lastCheckedAt: text('last_checked_at'),
	lastResponseMs: integer('last_response_ms'),
	lastStatusCode: integer('last_status_code'),
	lastError: text('last_error'),
	sslExpiresAt: text('ssl_expires_at'),
	downSince: text('down_since'),
	/** Fehlversuche in Folge – Alarm erst ab dem zweiten */
	failures: integer('failures').notNull().default(0),
	createdAt: created()
});

export const monitorChecks = sqliteTable(
	'monitor_checks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		monitorId: integer('monitor_id')
			.notNull()
			.references(() => monitors.id, { onDelete: 'cascade' }),
		at: text('at').notNull(),
		ok: bool('ok').notNull(),
		statusCode: integer('status_code'),
		responseMs: integer('response_ms'),
		error: text('error')
	},
	(t) => [index('monitor_checks_idx').on(t.monitorId, t.at)]
);

/* ------------------------------------------------------------------ Angebote & Rechnungen */

export const documents = sqliteTable(
	'documents',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		type: text('type', { enum: ['angebot', 'rechnung'] }).notNull(),
		/** fortlaufend, wird erst beim Festschreiben vergeben */
		number: text('number').unique(),
		/** Nummernkreis und laufende Nummer darin (z. B. „rechnung-2026“ / 14) – zum Freigeben beim Löschen */
		seqKey: text('seq_key'),
		seq: integer('seq'),
		/** entwurf · offen (festgeschrieben/versendet) · angenommen · abgelehnt · bezahlt · storniert */
		status: text('status', { enum: ['entwurf', 'offen', 'angenommen', 'abgelehnt', 'bezahlt', 'storniert'] })
			.notNull()
			.default('entwurf'),
		customerId: integer('customer_id')
			.notNull()
			.references(() => customers.id, { onDelete: 'restrict' }),
		projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
		contractId: integer('contract_id').references(() => contracts.id, { onDelete: 'set null' }),
		/** Rechnung aus diesem Angebot */
		quoteId: integer('quote_id').references((): AnySQLiteColumn => documents.id, { onDelete: 'set null' }),
		/** Stornorechnung zu dieser Rechnung */
		cancelsId: integer('cancels_id').references((): AnySQLiteColumn => documents.id, { onDelete: 'restrict' }),
		issueDate: text('issue_date').notNull(),
		/** Rechnung: fällig am · Angebot: gültig bis */
		dueDate: text('due_date'),
		servicePeriod: text('service_period'),
		title: text('title').notNull(),
		intro: text('intro'),
		outro: text('outro'),
		/** Empfänger zum Zeitpunkt des Festschreibens (JSON) */
		recipient: text('recipient'),
		/** Absender zum Zeitpunkt des Festschreibens (JSON) */
		sender: text('sender'),
		taxMode: text('tax_mode', { enum: ['klein', 'ust'] })
			.notNull()
			.default('klein'),
		taxRate: integer('tax_rate').notNull().default(20),
		netCents: integer('net_cents').notNull().default(0),
		taxCents: integer('tax_cents').notNull().default(0),
		grossCents: integer('gross_cents').notNull().default(0),
		finalizedAt: text('finalized_at'),
		sentAt: text('sent_at'),
		decidedAt: text('decided_at'),
		paidAt: text('paid_at'),
		remindedAt: text('reminded_at'),
		/** festgeschriebenes PDF unter /data/portal/belege */
		pdfFile: text('pdf_file'),
		/** Angebote: geheimer Schlüssel für den Link auf der Webseite (astronox.dev/angebot/…) zum Annehmen oder Ändern */
		publicToken: text('public_token').unique(),
		createdAt: created(),
		updatedAt: updated()
	},
	(t) => [index('documents_type_idx').on(t.type, t.issueDate), index('documents_customer_idx').on(t.customerId)]
);

export const documentItems = sqliteTable('document_items', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	documentId: integer('document_id')
		.notNull()
		.references(() => documents.id, { onDelete: 'cascade' }),
	position: integer('position').notNull().default(0),
	title: text('title').notNull(),
	description: text('description'),
	quantity: real('quantity').notNull().default(1),
	unit: text('unit').notNull().default('Stk.'),
	unitPriceCents: integer('unit_price_cents').notNull().default(0),
	totalCents: integer('total_cents').notNull().default(0)
});

/** Nummernkreise, z. B. „rechnung-2026“ → 14 */
export const sequences = sqliteTable('sequences', {
	key: text('key').primaryKey(),
	last: integer('last').notNull().default(0),
	/** höchste Nummer eines gelöschten, aber schon verschickten Belegs – wird nie wieder vergeben */
	floor: integer('floor').notNull().default(0)
});

/* ------------------------------------------------------------------ E-Mail */

export const mailMessages = sqliteTable(
	'mail_messages',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		direction: text('direction', { enum: ['ein', 'aus'] }).notNull(),
		messageId: text('message_id'),
		inReplyTo: text('in_reply_to'),
		references: text('references'),
		fromAddr: text('from_addr').notNull(),
		fromName: text('from_name'),
		toAddrs: text('to_addrs').notNull(),
		ccAddrs: text('cc_addrs'),
		subject: text('subject').notNull(),
		text: text('text'),
		html: text('html'),
		date: text('date').notNull(),
		customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
		documentId: integer('document_id').references(() => documents.id, { onDelete: 'set null' }),
		seen: bool('seen').notNull().default(false),
		/** ignoriert = aus dem Posteingang ausgeblendet */
		ignored: bool('ignored').notNull().default(false),
		imapMailbox: text('imap_mailbox'),
		imapUid: integer('imap_uid'),
		/** JSON: [{ fileId, name, size }] */
		attachments: text('attachments').notNull().default('[]'),
		status: text('status', { enum: ['empfangen', 'gesendet', 'fehler'] })
			.notNull()
			.default('empfangen'),
		error: text('error'),
		createdAt: created()
	},
	(t) => [
		uniqueIndex('mail_imap_idx').on(t.imapMailbox, t.imapUid),
		index('mail_customer_idx').on(t.customerId, t.date),
		index('mail_message_id_idx').on(t.messageId),
		index('mail_date_idx').on(t.date)
	]
);

export const mailTemplates = sqliteTable('mail_templates', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/** fester Schlüssel für Vorlagen, die das Portal selbst verwendet (angebot, rechnung, mahnung) */
	key: text('key').unique(),
	name: text('name').notNull(),
	subject: text('subject').notNull(),
	body: text('body').notNull(),
	createdAt: created(),
	updatedAt: updated()
});

/* ------------------------------------------------------------------ Benachrichtigungen */

export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	userAgent: text('user_agent'),
	createdAt: created(),
	lastUsedAt: text('last_used_at')
});

export const notifications = sqliteTable(
	'notifications',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kind: text('kind').notNull(),
		title: text('title').notNull(),
		body: text('body'),
		url: text('url'),
		readAt: text('read_at'),
		createdAt: created()
	},
	(t) => [index('notifications_created_idx').on(t.createdAt)]
);

/* ------------------------------------------------------------------ Medien der Webseite */

export const media = sqliteTable('media', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	/** Dateiname unter /data/medien, ausgeliefert von der Webseite unter /medien/… */
	file: text('file').notNull().unique(),
	originalName: text('original_name').notNull(),
	width: integer('width').notNull(),
	height: integer('height').notNull(),
	size: integer('size').notNull(),
	alt: text('alt'),
	createdAt: created()
});

/* ------------------------------------------------------------------ Einnahmen & Ausgaben */

/** Wiederkehrende Ausgaben (Abos, Hosting, Versicherung …) – der tägliche Lauf bucht sie */
export const ledgerRecurring = sqliteTable('ledger_recurring', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	description: text('description').notNull(),
	party: text('party'),
	category: text('category').notNull(),
	grossCents: integer('gross_cents').notNull(),
	taxRate: integer('tax_rate').notNull().default(20),
	paymentMethod: text('payment_method'),
	interval: text('interval', { enum: ['monat', 'quartal', 'halbjahr', 'jahr'] })
		.notNull()
		.default('monat'),
	/** nächste Buchung (YYYY-MM-DD) */
	nextDate: text('next_date').notNull(),
	endDate: text('end_date'),
	active: bool('active').notNull().default(true),
	createdAt: created()
});

/**
 * Einnahmen und Ausgaben, die nicht aus Rechnungen kommen (bezahlte Rechnungen
 * zählen automatisch). Datum = Tag der Zahlung (Zufluss-Abfluss-Prinzip).
 */
export const ledgerEntries = sqliteTable(
	'ledger_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		kind: text('kind', { enum: ['einnahme', 'ausgabe'] }).notNull(),
		date: text('date').notNull(),
		description: text('description').notNull(),
		/** Lieferant bzw. Zahler */
		party: text('party'),
		category: text('category').notNull(),
		grossCents: integer('gross_cents').notNull(),
		taxRate: integer('tax_rate').notNull().default(0),
		/** mit USt-Pflicht gebucht (Vorsteuer abziehbar) – Stand beim Anlegen */
		vat: bool('vat').notNull().default(false),
		paymentMethod: text('payment_method'),
		notes: text('notes'),
		/** Beleg unter /data/portal/ausgaben */
		receiptFile: text('receipt_file'),
		receiptName: text('receipt_name'),
		receiptMime: text('receipt_mime'),
		receiptSize: integer('receipt_size'),
		recurringId: integer('recurring_id').references(() => ledgerRecurring.id, { onDelete: 'set null' }),
		createdAt: created(),
		updatedAt: updated()
	},
	(t) => [index('ledger_entries_date_idx').on(t.date)]
);

/** Anlagenverzeichnis: Anschaffungen über 1.000 € werden über die Nutzungsdauer abgeschrieben */
export const assets = sqliteTable('assets', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	/** Inbetriebnahme (YYYY-MM-DD) – entscheidet über die Halbjahresregel */
	startDate: text('start_date').notNull(),
	/** Anschaffungskosten: netto mit Vorsteuerabzug, sonst brutto */
	costCents: integer('cost_cents').notNull(),
	years: integer('years').notNull(),
	disposedOn: text('disposed_on'),
	notes: text('notes'),
	receiptFile: text('receipt_file'),
	receiptName: text('receipt_name'),
	receiptMime: text('receipt_mime'),
	receiptSize: integer('receipt_size'),
	createdAt: created()
});

/* ------------------------------------------------------------------ Passwort-Tresor */

/**
 * Persönlicher Tresor je Konto. Verschlüsselt wird im Browser mit dem Master-Passwort
 * (PBKDF2 → AES-256-GCM, siehe $lib/shared/tresor) – hier liegt nur Chiffretext.
 */
export const vaults = sqliteTable('vaults', {
	userId: integer('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	salt: text('salt').notNull(),
	iterations: integer('iterations').notNull(),
	/** bekannter Text, verschlüsselt – damit lässt sich das Master-Passwort prüfen */
	checkIv: text('check_iv').notNull(),
	check: text('check').notNull(),
	createdAt: created(),
	updatedAt: updated()
});

/** Ein Eintrag = ein verschlüsseltes JSON (Titel, Benutzer, Passwort, Links, Notizen …) */
export const vaultItems = sqliteTable(
	'vault_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		iv: text('iv').notNull(),
		data: text('data').notNull(),
		createdAt: created(),
		updatedAt: updated()
	},
	(t) => [index('vault_items_user_idx').on(t.userId)]
);

export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractItem = typeof contractItems.$inferSelect;
export type ContractBilling = typeof contractBillings.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentItem = typeof documentItems.$inferSelect;
export type MailMessage = typeof mailMessages.$inferSelect;
export type MailTemplate = typeof mailTemplates.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type LedgerRecurring = typeof ledgerRecurring.$inferSelect;
export type Asset = typeof assets.$inferSelect;
