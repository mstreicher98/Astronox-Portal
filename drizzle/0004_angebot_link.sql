ALTER TABLE `documents` ADD `public_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `documents_public_token_unique` ON `documents` (`public_token`);