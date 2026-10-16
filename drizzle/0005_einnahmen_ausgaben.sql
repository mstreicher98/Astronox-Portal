CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`cost_cents` integer NOT NULL,
	`years` integer NOT NULL,
	`disposed_on` text,
	`notes` text,
	`receipt_file` text,
	`receipt_name` text,
	`receipt_mime` text,
	`receipt_size` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`party` text,
	`category` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`vat` integer DEFAULT false NOT NULL,
	`payment_method` text,
	`notes` text,
	`receipt_file` text,
	`receipt_name` text,
	`receipt_mime` text,
	`receipt_size` integer,
	`recurring_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`recurring_id`) REFERENCES `ledger_recurring`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ledger_entries_date_idx` ON `ledger_entries` (`date`);--> statement-breakpoint
CREATE TABLE `ledger_recurring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`party` text,
	`category` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`tax_rate` integer DEFAULT 20 NOT NULL,
	`payment_method` text,
	`interval` text DEFAULT 'monat' NOT NULL,
	`next_date` text NOT NULL,
	`end_date` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
