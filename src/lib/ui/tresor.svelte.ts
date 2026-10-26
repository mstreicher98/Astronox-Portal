/** Nach so langer Zeit ohne Klick oder Tastendruck sperrt sich der Tresor */
export const LOCK_MINUTES = 15;

/**
 * Entsperrter Passwort-Tresor. Der Schlüssel liegt nur im Speicher dieses Tabs:
 * nach Neuladen, Abmelden, „Sperren“ oder 15 Minuten ohne Aktivität ist er weg.
 */
class Tresor {
	#key: CryptoKey | null = null;
	#timer: ReturnType<typeof setTimeout> | undefined;
	unlocked = $state(false);

	/** reaktiv: null, solange gesperrt */
	get key(): CryptoKey | null {
		return this.unlocked ? this.#key : null;
	}

	open(key: CryptoKey) {
		this.#key = key;
		this.unlocked = true;
		window.addEventListener('pointerdown', this.#touch, { passive: true });
		window.addEventListener('keydown', this.#touch, { passive: true });
		this.#touch();
	}

	lock() {
		this.#key = null;
		this.unlocked = false;
		clearTimeout(this.#timer);
		window.removeEventListener('pointerdown', this.#touch);
		window.removeEventListener('keydown', this.#touch);
	}

	#touch = () => {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.lock(), LOCK_MINUTES * 60_000);
	};
}

export const tresor = new Tresor();
