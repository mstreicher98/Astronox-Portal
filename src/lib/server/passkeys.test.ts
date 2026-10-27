import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers';
import { describe, expect, it } from 'vitest';
import { deviceName, loginOptions, registrationOptions, relyingParty, verifyLogin, verifyNew } from './passkeys';

/** Ein Authenticator in Software – signiert wie ein Handy mit Fingerabdruck */
class SoftAuthenticator {
	readonly id = randomBytes(16);
	private keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	private count = 0;

	constructor(private rp: { origin: string; rpID: string }) {}

	private authData(flags: number, attested?: Uint8Array) {
		const head = Buffer.alloc(37);
		createHash('sha256').update(this.rp.rpID).digest().copy(head, 0);
		head[32] = flags;
		head.writeUInt32BE(this.count, 33);
		return attested ? Buffer.concat([head, attested]) : head;
	}

	private coseKey(pub: KeyObject) {
		const jwk = pub.export({ format: 'jwk' });
		return isoCBOR.encode(
			new Map<number, number | Uint8Array>([
				[1, 2],
				[3, -7],
				[-1, 1],
				[-2, isoBase64URL.toBuffer(jwk.x!)],
				[-3, isoBase64URL.toBuffer(jwk.y!)]
			])
		);
	}

	create(challenge: string, origin = this.rp.origin, flags = 0x45) {
		const cred = Buffer.concat([Buffer.alloc(16), Buffer.from([0, this.id.length]), this.id, Buffer.from(this.coseKey(this.keys.publicKey))]);
		const attestationObject = isoCBOR.encode(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', this.authData(flags, cred)]]) as never);
		const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin }));
		const id = isoBase64URL.fromBuffer(this.id);
		return {
			id,
			rawId: id,
			type: 'public-key' as const,
			clientExtensionResults: {},
			response: { attestationObject: isoBase64URL.fromBuffer(attestationObject), clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON), transports: ['internal' as const] }
		};
	}

	get(challenge: string, origin = this.rp.origin, flags = 0x05) {
		this.count++;
		const authData = this.authData(flags);
		const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
		const signature = sign('sha256', Buffer.concat([authData, createHash('sha256').update(clientDataJSON).digest()]), this.keys.privateKey);
		const id = isoBase64URL.fromBuffer(this.id);
		return {
			id,
			rawId: id,
			type: 'public-key' as const,
			clientExtensionResults: {},
			response: { authenticatorData: isoBase64URL.fromBuffer(authData), clientDataJSON: isoBase64URL.fromBuffer(clientDataJSON), signature: isoBase64URL.fromBuffer(signature) }
		};
	}
}

const rp = relyingParty(new URL('https://portal.astronox.dev/einstellungen/sicherheit'));
const user = { id: 7, email: 'office@astronox.dev', name: 'Test' };

async function registered() {
	const auth = new SoftAuthenticator(rp);
	const options = await registrationOptions(rp, user, []);
	const stored = await verifyNew(rp, user.id, auth.create(options.challenge));
	return { auth, stored: stored! };
}

describe('Passkeys', () => {
	it('richtet ein und meldet an', async () => {
		const { auth, stored } = await registered();
		expect(stored.id).toBe(isoBase64URL.fromBuffer(auth.id));
		const options = await loginOptions(rp);
		expect(options.rpId).toBe('portal.astronox.dev');
		expect(await verifyLogin(rp, auth.get(options.challenge), stored)).toEqual({ counter: 1 });
	});

	it('verlangt Fingerabdruck oder PIN (user verification)', async () => {
		const auth = new SoftAuthenticator(rp);
		const options = await registrationOptions(rp, user, []);
		await expect(verifyNew(rp, user.id, auth.create(options.challenge, rp.origin, 0x41))).rejects.toThrow();
	});

	it('nimmt jede Challenge nur einmal', async () => {
		const { auth, stored } = await registered();
		const { challenge } = await loginOptions(rp);
		expect(await verifyLogin(rp, auth.get(challenge), stored)).not.toBeNull();
		await expect(verifyLogin(rp, auth.get(challenge), stored)).rejects.toThrow();
	});

	it('lehnt fremde Seiten und erfundene Challenges ab', async () => {
		const { auth, stored } = await registered();
		const { challenge } = await loginOptions(rp);
		await expect(verifyLogin(rp, auth.get(challenge, 'https://evil.example'), stored)).rejects.toThrow();
		await expect(verifyLogin(rp, auth.get(isoBase64URL.fromBuffer(randomBytes(32))), stored)).rejects.toThrow();
	});

	it('Einrichten gilt nur für das Konto, das es begonnen hat', async () => {
		const auth = new SoftAuthenticator(rp);
		const options = await registrationOptions(rp, user, []);
		await expect(verifyNew(rp, 99, auth.create(options.challenge))).rejects.toThrow();
	});

	it('erkennt den Gerätenamen', () => {
		expect(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36')).toBe('Android – Chrome');
		expect(deviceName(null)).toBe('Gerät');
	});
});
