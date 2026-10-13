/** Rückfrage vor heiklen Aktionen – eigener Dialog statt window.confirm */

interface Question {
	text: string;
	detail?: string;
	confirm: string;
	danger: boolean;
	resolve: (ok: boolean) => void;
}

export const question = $state<{ current: Question | null }>({ current: null });

export function ask(text: string, opts: { detail?: string; confirm?: string; danger?: boolean } = {}): Promise<boolean> {
	return new Promise((resolve) => {
		question.current = { text, detail: opts.detail, confirm: opts.confirm ?? 'Ja', danger: opts.danger ?? true, resolve };
	});
}

export function answer(ok: boolean) {
	question.current?.resolve(ok);
	question.current = null;
}
