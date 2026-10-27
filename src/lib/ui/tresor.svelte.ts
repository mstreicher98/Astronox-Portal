import { getContext, setContext } from 'svelte';
import type { OtpImport } from '$lib/shared/otp';
import type { VaultEntry } from '$lib/shared/tresor';

/** Nach so langer Zeit ohne Klick oder Tastendruck sperrt sich der Tresor */
export const LOCK_MINUTES = 15;

export interface VaultItem extends VaultEntry {
	id: number;
	updatedAt: string;
	/** ließ sich nicht entschlüsseln */
	broken: boolean;
}

/** „passwort“ = voller Eintrag, „konto“ = Authenticator zuerst */
export type EditMode = 'passwort' | 'konto';

/** Was Passwörter und Authenticator vom gemeinsamen Layout bekommen */
export interface VaultContext {
	readonly items: VaultItem[];
	readonly ready: boolean;
	readonly categories: string[];
	edit(item: VaultItem | null, mode?: EditMode): void;
	remove(item: VaultItem): Promise<void>;
	importAccounts(list: OtpImport[]): Promise<void>;
	openMaster(): void;
	openBiometric(): void;
	copy(text: string, what: string, secret: boolean): Promise<void>;
}

const KEY = Symbol('tresor');
export const setVault = (c: VaultContext) => setContext(KEY, c);
export const useVault = () => getContext<VaultContext>(KEY);

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
