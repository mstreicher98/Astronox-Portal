-- Belegnummern „RE26 1“ statt „RE-2026-001“: nur wenn noch die alten Standardwerte gespeichert sind
UPDATE `settings` SET `value` = json_set(`value`, '$.invoicePrefix', 'RE{JJ} {NR}', '$.quotePrefix', 'AN{JJ} {NR}', '$.digits', 1)
WHERE `key` = 'rechnung' AND json_extract(`value`, '$.invoicePrefix') = 'RE-{JJJJ}-' AND json_extract(`value`, '$.quotePrefix') = 'AN-{JJJJ}-';
