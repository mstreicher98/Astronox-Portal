import { afterEach, describe, expect, it, vi } from 'vitest';
import { passkeyProblem, prfSecret } from './passkey';

/** Nachgebautes navigator.credentials.get – merkt sich die Optionen */
function fakeGet(result: { id: string; first?: ArrayBuffer } | null) {
	const get = vi.fn(async () => (result ? { id: result.id, getClientExtensionResults: () => (result.first ? { prf: { results: { first: result.first } } } : {}) } : null));
	vi.stubGlobal('navigator', { credentials: { get } });
	return get;
}

const optionsOf = (get: ReturnType<typeof fakeGet>) => (get.mock.calls[0] as unknown as [{ publicKey: { extensions: { prf: Record<string, unknown> } } }])[0].publicKey;

afterEach(() => vi.unstubAllGlobals());

describe('PRF-Geheimnis für den Tresor', () => {
	it('nimmt „eval“, wenn alle Passkeys dasselbe Salz haben', async () => {
		const get = fakeGet({ id: 'b', first: new Uint8Array([1, 2]).buffer });
		const r = await prfSecret('portal.astronox.dev', [
			{ id: 'YQ', salt: 'AAAAAAAAAAAAAAAAAAAAAA==' },
			{ id: 'Yg', salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }
		]);
		expect(Object.keys(optionsOf(get).extensions.prf)).toEqual(['eval']);
		expect(r?.id).toBe('b');
	});

	it('nimmt „evalByCredential“ bei verschiedenen Salzen', async () => {
		const get = fakeGet({ id: 'YQ', first: new ArrayBuffer(32) });
		await prfSecret('portal.astronox.dev', [
			{ id: 'YQ', salt: 'AAAAAAAAAAAAAAAAAAAAAA==' },
			{ id: 'Yg', salt: 'AQAAAAAAAAAAAAAAAAAAAA==' }
		]);
		expect(Object.keys(optionsOf(get).extensions.prf)).toEqual(['evalByCredential']);
	});

	it('meldet null, wenn der Passwort-Manager kein PRF liefert', async () => {
		fakeGet({ id: 'YQ' });
		expect(await prfSecret('portal.astronox.dev', [{ id: 'YQ', salt: 'AAAAAAAAAAAAAAAAAAAAAA==' }])).toBeNull();
	});

	it('erklärt Fehler verständlich', () => {
		const e = (name: string) => Object.assign(new Error('x'), { name });
		expect(passkeyProblem(e('NotAllowedError'))).toContain('kein Passkey');
		expect(passkeyProblem(e('NotSupportedError'))).toContain('NotSupportedError');
		expect(passkeyProblem(e('Error'))).toBe('Das hat nicht geklappt.');
	});
});
