import { afterEach, describe, expect, it, vi } from 'vitest';

// Schlüssel im Test unverschlüsselt („v1:<klartext>“)
vi.mock('./secret', () => ({ decrypt: (v?: string | null) => (v?.startsWith('v1:') ? v.slice(3) : '') }));

const { microsoftHint, microsoftToken, tokenRoles } = await import('./microsoft');

const jwt = (payload: object) => `kopf.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signatur`;
const app = { tenantId: 'mandant-1', clientId: 'app-1', clientSecret: 'v1:geheim' };

afterEach(() => vi.unstubAllGlobals());

describe('microsoftToken', () => {
	it('holt ein Token per Client-Credentials und merkt es sich', async () => {
		const fetch = vi.fn(async () => Response.json({ access_token: 'token-1', expires_in: 3599 }));
		vi.stubGlobal('fetch', fetch);
		expect(await microsoftToken(app)).toBe('token-1');
		expect(await microsoftToken(app)).toBe('token-1');
		expect(fetch).toHaveBeenCalledTimes(1);

		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://login.microsoftonline.com/mandant-1/oauth2/v2.0/token');
		const body = new URLSearchParams(String(init.body));
		expect(Object.fromEntries(body)).toEqual({
			client_id: 'app-1',
			client_secret: 'geheim',
			scope: 'https://outlook.office365.com/.default',
			grant_type: 'client_credentials'
		});
	});

	it('fresh holt immer ein neues Token', async () => {
		const fetch = vi.fn(async () => Response.json({ access_token: 'token-2', expires_in: 3599 }));
		vi.stubGlobal('fetch', fetch);
		expect(await microsoftToken(app, { fresh: true })).toBe('token-2');
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('erklärt bekannte Fehler von Entra', async () => {
		vi.stubGlobal('fetch', async () =>
			Response.json({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.\r\nTrace ID: x' }, { status: 401 })
		);
		await expect(microsoftToken({ ...app, clientSecret: 'v1:falsch' })).rejects.toThrow(/nicht die „Geheimnis-ID“.*AADSTS7000215/);
	});

	it('meldet fehlende Angaben, ohne Microsoft zu fragen', async () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		await expect(microsoftToken({ ...app, clientSecret: '' })).rejects.toThrow(/nicht vollständig eingerichtet/);
		await expect(microsoftToken(undefined)).rejects.toThrow(/nicht vollständig eingerichtet/);
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('tokenRoles', () => {
	it('liest die Berechtigungen aus dem Token', () => {
		expect(tokenRoles(jwt({ roles: ['IMAP.AccessAsApp', 'SMTP.SendAsApp'] }))).toEqual(['IMAP.AccessAsApp', 'SMTP.SendAsApp']);
		expect(tokenRoles(jwt({}))).toEqual([]);
		expect(tokenRoles('kaputt')).toEqual([]);
	});
});

describe('microsoftHint', () => {
	it('ergänzt den wahrscheinlichen Grund', () => {
		expect(microsoftHint('535 5.7.139 Authentication unsuccessful, SmtpClientAuthentication is disabled for the Tenant.')).toMatch(/Set-CASMailbox/);
		expect(microsoftHint('535 5.7.3 Authentication unsuccessful')).toMatch(/New-ServicePrincipal/);
		expect(microsoftHint('AUTHENTICATE failed.')).toMatch(/Add-MailboxPermission/);
		expect(microsoftHint('554 5.2.252 SendAsDenied')).toMatch(/Absender/);
		expect(microsoftHint('Zeitüberschreitung')).toBe('Zeitüberschreitung');
	});
});
