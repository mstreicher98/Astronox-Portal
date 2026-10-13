/** Kurze Hinweise unten rechts („Gespeichert“, Fehlermeldungen) */

export interface Toast {
	id: number;
	text: string;
	kind: 'ok' | 'error' | 'info';
}

let next = 1;
export const toasts = $state<Toast[]>([]);

export function toast(text: string, kind: Toast['kind'] = 'ok', ms = kind === 'error' ? 6000 : 3200) {
	const id = next++;
	toasts.push({ id, text, kind });
	setTimeout(() => dismiss(id), ms);
}

export function dismiss(id: number) {
	const i = toasts.findIndex((t) => t.id === id);
	if (i >= 0) toasts.splice(i, 1);
}
