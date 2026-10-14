/**
 * Belegnummer aus dem Format in den Einstellungen.
 * {JJJJ} = Jahr, {JJ} = Jahr zweistellig, {NR} = laufende Nummer des Jahres.
 * Fehlt {NR}, steht die Nummer am Ende (alte Vorsilben wie „RE-{JJJJ}-“).
 */
export function documentNumber(format: string, year: number | string, n: number, digits: number): string {
	const y = String(year);
	const nr = String(n).padStart(Math.max(1, digits), '0');
	const out = format.replaceAll('{JJJJ}', y).replaceAll('{JJ}', y.slice(-2));
	return out.includes('{NR}') ? out.replaceAll('{NR}', nr) : out + nr;
}
