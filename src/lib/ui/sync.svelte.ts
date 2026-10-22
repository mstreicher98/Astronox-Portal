import { untrack } from 'svelte';

/**
 * Übernimmt Daten vom Server in einen bearbeitbaren Zustand – aber nur, wenn sie sich
 * wirklich geändert haben (nach dem Speichern, auf einer anderen Seite). Das Portal lädt
 * alle 30 s und beim Zurückkehren ins Fenster die Zähler im Menü neu; dabei bekommt jede
 * Seite ein neues `data`, und ein einfaches $effect würde jedes Mal überschreiben, was
 * gerade getippt wird.
 *
 *   let v = $state(fresh());
 *   onServerChange(() => data.value, () => (v = fresh()));
 */
export function onServerChange(source: () => unknown, apply: () => void) {
	const key = $derived(JSON.stringify(source()));
	$effect(() => {
		void key;
		untrack(apply);
	});
}
