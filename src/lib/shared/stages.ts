/** Phasen der Pipeline – Farben entlang des Nebelverlaufs */

export const STAGE_IDS = ['anfrage', 'erstgespraech', 'angebot', 'auftrag', 'in_arbeit', 'abnahme', 'abgeschlossen', 'verloren'] as const;
export type StageId = (typeof STAGE_IDS)[number];

export const STAGES: { id: StageId; label: string; color: string; hint: string }[] = [
	{ id: 'anfrage', label: 'Anfrage', color: '#5eead4', hint: 'Neu über die Webseite oder selbst angelegt' },
	{ id: 'erstgespraech', label: 'Erstgespräch', color: '#7dd3fc', hint: 'Gespräch vereinbart oder geführt' },
	{ id: 'angebot', label: 'Angebot', color: '#8f9bff', hint: 'Angebot in Arbeit oder verschickt' },
	{ id: 'auftrag', label: 'Auftrag', color: '#b197fc', hint: 'Angebot angenommen' },
	{ id: 'in_arbeit', label: 'In Arbeit', color: '#e087d4', hint: 'Design und Entwicklung' },
	{ id: 'abnahme', label: 'Abnahme', color: '#f472b6', hint: 'Test und Freigabe durch den Kunden' },
	{ id: 'abgeschlossen', label: 'Abgeschlossen', color: '#8fe3b4', hint: 'Online und abgerechnet' },
	{ id: 'verloren', label: 'Verloren', color: '#7880a3', hint: 'Kein Auftrag' }
];

export const OPEN_STAGES: StageId[] = ['anfrage', 'erstgespraech', 'angebot', 'auftrag', 'in_arbeit', 'abnahme'];
/** Phasen, in denen gerade gebaut wird */
export const ACTIVE_STAGES: StageId[] = ['auftrag', 'in_arbeit', 'abnahme'];

export const stageOf = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];
export const stageIndex = (id: string) => STAGES.findIndex((s) => s.id === id);

export const PROJECT_KINDS = [
	{ id: 'webseite', label: 'Webseite' },
	{ id: 'redesign', label: 'Redesign' },
	{ id: 'webapp', label: 'Web-App' },
	{ id: 'tool', label: 'Internes Tool' },
	{ id: 'webshop', label: 'Webshop' },
	{ id: 'hosting', label: 'Hosting & Wartung' },
	{ id: 'sonstiges', label: 'Sonstiges' }
];

export const kindLabel = (id: string) => PROJECT_KINDS.find((k) => k.id === id)?.label ?? id;

export const INTERVALS = [
	{ id: 'monat', label: 'monatlich', months: 1 },
	{ id: 'quartal', label: 'quartalsweise', months: 3 },
	{ id: 'halbjahr', label: 'halbjährlich', months: 6 },
	{ id: 'jahr', label: 'jährlich', months: 12 }
] as const;

export type IntervalId = (typeof INTERVALS)[number]['id'];

export const intervalOf = (id: string) => INTERVALS.find((i) => i.id === id) ?? INTERVALS[0];

/** Vertragsarten – Farben wie die Leistungen auf der Webseite */
export const CONTRACT_KIND_IDS = ['hosting', 'wartung', 'support', 'sonstiges'] as const;
export type ContractKind = (typeof CONTRACT_KIND_IDS)[number];

export const CONTRACT_KINDS: { id: ContractKind; label: string; color: string; title: string; item: string; description: string }[] = [
	{ id: 'hosting', label: 'Hosting', color: '#f472b6', title: 'Hosting', item: 'Hosting', description: 'Betrieb der Webseite inkl. SSL-Zertifikat und täglicher Sicherung' },
	{ id: 'wartung', label: 'Wartung', color: '#7dd3fc', title: 'Wartung', item: 'Wartung', description: 'Updates, Sicherheitsprüfungen und Überwachung der Erreichbarkeit' },
	{ id: 'support', label: 'Support', color: '#b197fc', title: 'Support', item: 'Support-Pauschale', description: 'Kleine Änderungen und Hilfe per E-Mail und Telefon' },
	{ id: 'sonstiges', label: 'Sonstiges', color: '#5eead4', title: 'Laufende Leistung', item: 'Laufende Leistung', description: '' }
];

export const contractKindOf = (id: string) => CONTRACT_KINDS.find((k) => k.id === id) ?? CONTRACT_KINDS[3];

export const DOC_STATUS: Record<string, { label: string; tone: 'muted' | 'info' | 'ok' | 'warn' | 'danger' }> = {
	entwurf: { label: 'Entwurf', tone: 'muted' },
	offen: { label: 'Offen', tone: 'info' },
	angenommen: { label: 'Angenommen', tone: 'ok' },
	abgelehnt: { label: 'Abgelehnt', tone: 'muted' },
	bezahlt: { label: 'Bezahlt', tone: 'ok' },
	storniert: { label: 'Storniert', tone: 'muted' }
};
