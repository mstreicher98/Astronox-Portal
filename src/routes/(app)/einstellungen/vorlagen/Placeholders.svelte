<script lang="ts">
	/** Platzhalter zum Anklicken – fügt sie an der Schreibmarke ein */
	let { fields, oninsert }: { fields: readonly string[]; oninsert: (field: string) => void } = $props();

	const HINTS: Record<string, string> = {
		anrede: 'z. B. „Guten Tag Erika Muster,“',
		name: 'Name',
		email: 'E-Mail-Adresse',
		projekt: 'Projekt',
		termin: 'Datum und Uhrzeit des Termins',
		datum: 'Datum',
		art: 'Telefon oder Video-Call',
		ablauf: 'Satz zum Ablauf (unten einstellbar)',
		details: 'Tabelle mit allen Angaben – eigener Absatz',
		knopf: 'Knopf mit Link – eigener Absatz',
		nummer: 'Nummer des Belegs',
		titel: 'Titel des Belegs',
		betrag: 'Betrag',
		zeitraum: 'Abrechnungszeitraum',
		grund: 'Grund der Absage'
	};
</script>

<div class="chips" aria-label="Platzhalter einfügen">
	{#each fields as f (f)}
		<button type="button" class="chip" title={HINTS[f] ?? f} onclick={() => oninsert(f)}>{`{{${f}}}`}</button>
	{/each}
</div>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--line-soft);
		border-radius: 999px;
		background: var(--nebula-soft);
		color: var(--dust);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		cursor: pointer;
		transition:
			color 0.2s,
			border-color 0.2s;
	}

	.chip:hover {
		color: var(--star);
		border-color: var(--nebula);
	}
</style>
