CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`meta` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_customer_idx` ON `activities` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activities_project_idx` ON `activities` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`email` text,
	`phone` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contacts_email_idx` ON `contacts` (`email`);--> statement-breakpoint
CREATE INDEX `contacts_customer_idx` ON `contacts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`project_id` integer,
	`title` text NOT NULL,
	`description` text,
	`amount_cents` integer NOT NULL,
	`interval` text DEFAULT 'monat' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`next_invoice_date` text NOT NULL,
	`auto_invoice` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`label` text NOT NULL,
	`url` text,
	`username` text,
	`secret` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'firma' NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`website` text,
	`street` text,
	`zip` text,
	`city` text,
	`country` text DEFAULT 'Österreich' NOT NULL,
	`vat_id` text,
	`notes` text,
	`source` text DEFAULT 'manuell' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE INDEX `customers_email_idx` ON `customers` (`email`);--> statement-breakpoint
CREATE TABLE `document_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'Stk.' NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`number` text,
	`status` text DEFAULT 'entwurf' NOT NULL,
	`customer_id` integer NOT NULL,
	`project_id` integer,
	`contract_id` integer,
	`quote_id` integer,
	`cancels_id` integer,
	`issue_date` text NOT NULL,
	`due_date` text,
	`service_period` text,
	`title` text NOT NULL,
	`intro` text,
	`outro` text,
	`recipient` text,
	`sender` text,
	`tax_mode` text DEFAULT 'klein' NOT NULL,
	`tax_rate` integer DEFAULT 20 NOT NULL,
	`net_cents` integer DEFAULT 0 NOT NULL,
	`tax_cents` integer DEFAULT 0 NOT NULL,
	`gross_cents` integer DEFAULT 0 NOT NULL,
	`finalized_at` text,
	`sent_at` text,
	`decided_at` text,
	`paid_at` text,
	`reminded_at` text,
	`pdf_file` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`quote_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cancels_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_number_unique` ON `documents` (`number`);--> statement-breakpoint
CREATE INDEX `documents_type_idx` ON `documents` (`type`,`issue_date`);--> statement-breakpoint
CREATE INDEX `documents_customer_idx` ON `documents` (`customer_id`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`name` text NOT NULL,
	`registrar` text,
	`expires_on` text,
	`auto_renew` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`name` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`source` text DEFAULT 'upload' NOT NULL,
	`mail_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_stored_name_unique` ON `files` (`stored_name`);--> statement-breakpoint
CREATE INDEX `files_project_idx` ON `files` (`project_id`);--> statement-breakpoint
CREATE INDEX `files_customer_idx` ON `files` (`customer_id`);--> statement-breakpoint
CREATE TABLE `mail_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`direction` text NOT NULL,
	`message_id` text,
	`in_reply_to` text,
	`references` text,
	`from_addr` text NOT NULL,
	`from_name` text,
	`to_addrs` text NOT NULL,
	`cc_addrs` text,
	`subject` text NOT NULL,
	`text` text,
	`html` text,
	`date` text NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`document_id` integer,
	`seen` integer DEFAULT false NOT NULL,
	`ignored` integer DEFAULT false NOT NULL,
	`imap_mailbox` text,
	`imap_uid` integer,
	`attachments` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'empfangen' NOT NULL,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_imap_idx` ON `mail_messages` (`imap_mailbox`,`imap_uid`);--> statement-breakpoint
CREATE INDEX `mail_customer_idx` ON `mail_messages` (`customer_id`,`date`);--> statement-breakpoint
CREATE INDEX `mail_message_id_idx` ON `mail_messages` (`message_id`);--> statement-breakpoint
CREATE INDEX `mail_date_idx` ON `mail_messages` (`date`);--> statement-breakpoint
CREATE TABLE `mail_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_templates_key_unique` ON `mail_templates` (`key`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file` text NOT NULL,
	`original_name` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`size` integer NOT NULL,
	`alt` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_file_unique` ON `media` (`file`);--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`done_at` text,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitor_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monitor_id` integer NOT NULL,
	`at` text NOT NULL,
	`ok` integer NOT NULL,
	`status_code` integer,
	`response_ms` integer,
	`error` text,
	FOREIGN KEY (`monitor_id`) REFERENCES `monitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `monitor_checks_idx` ON `monitor_checks` (`monitor_id`,`at`);--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer,
	`project_id` integer,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`keyword` text,
	`interval_min` integer DEFAULT 5 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'unbekannt' NOT NULL,
	`last_checked_at` text,
	`last_response_ms` integer,
	`last_status_code` integer,
	`last_error` text,
	`ssl_expires_at` text,
	`down_since` text,
	`failures` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`url` text,
	`read_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'webseite' NOT NULL,
	`stage` text DEFAULT 'anfrage' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`value_cents` integer,
	`budget_label` text,
	`timeframe_label` text,
	`start_date` text,
	`due_date` text,
	`hourly_rate_cents` integer,
	`description` text,
	`inquiry_id` integer,
	`booking_id` integer,
	`repo_url` text,
	`live_url` text,
	`staging_url` text,
	`lost_reason` text,
	`stage_changed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`closed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `projects_stage_idx` ON `projects` (`stage`,`position`);--> statement-breakpoint
CREATE INDEX `projects_customer_idx` ON `projects` (`customer_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `sequences` (
	`key` text PRIMARY KEY NOT NULL,
	`last` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `portal_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`user_agent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_seen_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`milestone_id` integer,
	`title` text NOT NULL,
	`notes` text,
	`due_date` text,
	`done_at` text,
	`position` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `milestones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`task_id` integer,
	`description` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	`minutes` integer DEFAULT 0 NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`rate_cents` integer,
	`invoice_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`invoice_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_project_idx` ON `time_entries` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `time_started_idx` ON `time_entries` (`started_at`);--> statement-breakpoint
CREATE TABLE `portal_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`totp_secret` text,
	`totp_enabled` integer DEFAULT false NOT NULL,
	`recovery_codes` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_login_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_users_email_unique` ON `portal_users` (`email`);