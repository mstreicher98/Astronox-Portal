ALTER TABLE `documents` ADD `seq_key` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `seq` integer;--> statement-breakpoint
ALTER TABLE `sequences` ADD `floor` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Bestehende Nummern zuordnen („RE-2026-001“ und „RE26 1“), damit gelöschte Belege ihre Nummer freigeben können
UPDATE `documents` SET `seq_key` = `type` || '-' || substr(`number`, 4, 4), `seq` = CAST(substr(`number`, 9) AS INTEGER)
WHERE `number` GLOB '[RA][EN]-[0-9][0-9][0-9][0-9]-[0-9]*';--> statement-breakpoint
UPDATE `documents` SET `seq_key` = `type` || '-20' || substr(`number`, 3, 2), `seq` = CAST(substr(`number`, 6) AS INTEGER)
WHERE `number` GLOB '[RA][EN][0-9][0-9] [0-9]*';
--> statement-breakpoint
-- Laufende Nummer mindestens vierstellig (RE26 0001)
UPDATE `settings` SET `value` = json_set(`value`, '$.digits', 4)
WHERE `key` = 'rechnung' AND json_extract(`value`, '$.digits') = 1 AND json_extract(`value`, '$.invoicePrefix') = 'RE{JJ} {NR}' AND json_extract(`value`, '$.quotePrefix') = 'AN{JJ} {NR}';
