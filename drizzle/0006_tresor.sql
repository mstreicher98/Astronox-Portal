CREATE TABLE `vault_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`iv` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vault_items_user_idx` ON `vault_items` (`user_id`);--> statement-breakpoint
CREATE TABLE `vaults` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	`iterations` integer NOT NULL,
	`check_iv` text NOT NULL,
	`check` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `portal_users`(`id`) ON UPDATE no action ON DELETE cascade
);
