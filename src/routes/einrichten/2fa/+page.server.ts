import { fail, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { enableTotp, newRecoveryCodes } from '$lib/server/auth';
import { decrypt, encrypt } from '$lib/server/secret';
import { newSecret, otpauthUrl, verifyCode } from '$lib/server/totp';
import type { Actions, PageServerLoad } from './$types';

/** Zwei-Faktor einrichten – Pflicht nach dem ersten Anmelden oder nach dem Zurücksetzen */

const COOKIE = 'portal_totp_neu';

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	const user = locals.user;
	if (!user) redirect(303, '/anmelden');
	if (user.totpEnabled) redirect(303, '/');
	let secret = decrypt(cookies.get(COOKIE));
	if (!secret) {
		secret = newSecret();
		cookies.set(COOKIE, encrypt(secret), { path: '/einrichten', httpOnly: true, sameSite: 'strict', secure: url.protocol === 'https:', maxAge: 1800 });
	}
	const uri = otpauthUrl(secret, user.email);
	const qr = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0b1330', light: '#ffffff' } });
	return { qr, secret: secret.replace(/(.{4})/g, '$1 ').trim() };
};

export const actions: Actions = {
	default: async ({ locals, request, cookies }) => {
		const user = locals.user;
		if (!user) redirect(303, '/anmelden');
		if (user.totpEnabled) redirect(303, '/');
		const secret = decrypt(cookies.get(COOKIE));
		if (!secret) return fail(400, { message: 'Die Einrichtung ist abgelaufen. Bitte die Seite neu laden und den QR-Code erneut scannen.' });
		const code = String((await request.formData()).get('code') ?? '');
		if (!verifyCode(secret, code)) return fail(400, { message: 'Der Code stimmt nicht. Bitte prüfen, ob die Uhrzeit am Handy stimmt, und den aktuellen Code eingeben.' });
		await enableTotp(user.id, secret);
		cookies.delete(COOKIE, { path: '/einrichten' });
		const codes = await newRecoveryCodes(user.id);
		return { codes };
	}
};
