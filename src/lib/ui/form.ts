import { applyAction } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import type { SubmitFunction } from '@sveltejs/kit';
import { ask } from './confirm.svelte';
import { toast } from './toast.svelte';

/**
 * Für `use:enhance={submit()}`: Knopf zeigt den Ladezustand, Rückmeldungen
 * erscheinen als Hinweis, danach werden die Daten der Seite neu geladen.
 *
 *   submit({ confirm: 'Wirklich löschen?', reset: true, done: () => (open = false) })
 */
export function submit(
	opts: {
		/** Rückfrage vor dem Absenden */
		confirm?: string;
		confirmDetail?: string;
		/** Formular nach Erfolg leeren */
		reset?: boolean;
		/** Hinweis bei Erfolg, wenn die Aktion keinen liefert */
		success?: string;
		done?: (data: Record<string, unknown> | undefined) => void;
	} = {}
): SubmitFunction {
	return async ({ submitter, cancel }) => {
		if (opts.confirm && !(await ask(opts.confirm, { detail: opts.confirmDetail }))) {
			cancel();
			return;
		}
		submitter?.classList.add('busy');
		return async ({ result, update }) => {
			submitter?.classList.remove('busy');
			if (result.type === 'success') {
				const data = result.data as Record<string, unknown> | undefined;
				const msg = (data?.message as string | undefined) ?? opts.success;
				if (msg) toast(msg, 'ok');
				await update({ reset: opts.reset ?? false });
				opts.done?.(data);
			} else if (result.type === 'failure') {
				toast((result.data?.message as string) || 'Das hat nicht geklappt.', 'error');
				await update({ reset: false });
			} else if (result.type === 'redirect') {
				await goto(result.location, { invalidateAll: true });
				opts.done?.(undefined);
			} else if (result.type === 'error') {
				toast(result.error?.message || 'Unerwarteter Fehler.', 'error');
				await applyAction(result);
			}
		};
	};
}

/** Kleine JSON-Anfrage an eine API-Route des Portals */
export async function api<T = unknown>(url: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg = (data as { message?: string }).message || 'Das hat nicht geklappt.';
		toast(msg, 'error');
		throw new Error(msg);
	}
	return data as T;
}

export const refresh = () => invalidateAll();
