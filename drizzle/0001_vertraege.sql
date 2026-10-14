CREATE TABLE `contract_billings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`document_id` integer,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contract_billings_contract_idx` ON `contract_billings` (`contract_id`,`period_from`);--> statement-breakpoint
CREATE TABLE `contract_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`contract_id` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`quantity` real DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'Pauschale' NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contract_items_contract_idx` ON `contract_items` (`contract_id`);--> statement-breakpoint
ALTER TABLE `contracts` ADD `kind` text DEFAULT 'hosting' NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `auto_send` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `min_term_months` integer;--> statement-breakpoint
ALTER TABLE `contracts` ADD `notice_months` integer;--> statement-breakpoint
ALTER TABLE `contracts` ADD `cancelled_on` text;--> statement-breakpoint
-- Bestehende Verträge: bisherige Bezeichnung, Beschreibung und Betrag werden die erste Position
INSERT INTO `contract_items` (`contract_id`, `position`, `title`, `description`, `quantity`, `unit`, `unit_price_cents`)
SELECT `id`, 0, `title`, `description`, 1, 'Pauschale', `amount_cents` FROM `contracts`;--> statement-breakpoint
UPDATE `contracts` SET `description` = NULL;
