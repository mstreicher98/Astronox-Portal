import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { vaults } from './db/schema';

/**
 * Prüfungen für den Passwort-Tresor. Der Server sieht nur Chiffretext – er kann
 * nur Form und Größe prüfen, nicht den Inhalt.
 */

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function b64(v: unknown, what: string, min: number, max: number): string {
	if (typeof v !== 'string' || v.length < min || v.length > max || !B64.test(v)) error(400, `${what} ist ungültig.`);
	return v;
}

/** Ein verschlüsseltes Stück { iv, data } – höchstens etwa 150 kB */
export function sealed(v: unknown): { iv: string; data: string } {
	const o = (v ?? {}) as { iv?: unknown; data?: unknown };
	return { iv: b64(o.iv, 'IV', 16, 16), data: b64(o.data, 'Eintrag', 24, 200_000) };
}

/** Salz und Runden des Master-Passworts */
export function keyParams(v: unknown): { salt: string; iterations: number } {
	const o = (v ?? {}) as { salt?: unknown; iterations?: unknown };
	const iterations = Number(o.iterations);
	if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 10_000_000) error(400, 'Runden sind ungültig.');
	return { salt: b64(o.salt, 'Salz', 24, 24), iterations };
}

export async function requireVault(userId: number) {
	const [v] = await db.select({ userId: vaults.userId }).from(vaults).where(eq(vaults.userId, userId));
	if (!v) error(409, 'Der Tresor ist noch nicht eingerichtet.');
}

export const body = async (request: Request) => (await request.json().catch(() => null)) as Record<string, unknown> | null;
