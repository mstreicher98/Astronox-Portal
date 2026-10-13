import { fail, redirect } from '@sveltejs/kit';
import { createSession, failedAttempt, hasUser, hashPassword, passwordProblem, setupCode, tooManyAttempts } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

/** Ersteinrichtung: nur solange es noch kein Konto gibt, geschützt mit dem Code aus dem Container-Protokoll */

export const load: PageServerLoad = async () => {
	if (await hasUser()) redirect(303, '/anmelden');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		if (await hasUser()) redirect(303, '/anmelden');
		const ip = getClientAddress();
		if (tooManyAttempts(`setup:${ip}`, 6)) return fail(429, { message: 'Zu viele Versuche. Bitte in 15 Minuten noch einmal.' });
		const fd = await request.formData();
		const code = String(fd.get('code') ?? '').trim().toUpperCase();
		const name = String(fd.get('name') ?? '').trim();
		const email = String(fd.get('email') ?? '').trim().toLowerCase();
		const password = String(fd.get('password') ?? '');
		const values = { name, email };
		if (code.replace(/[^A-Z0-9]/g, '') !== setupCode.replace('-', '')) {
			failedAttempt(`setup:${ip}`);
			return fail(400, { ...values, message: 'Der Einrichtungscode stimmt nicht. Er steht im Protokoll des Portal-Containers.' });
		}
		if (!name) return fail(400, { ...values, message: 'Bitte deinen Namen angeben.' });
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(400, { ...values, message: 'Bitte eine gültige E-Mail-Adresse angeben.' });
		const problem = passwordProblem(password);
		if (problem) return fail(400, { ...values, message: problem });
		if (password !== String(fd.get('password2') ?? '')) return fail(400, { ...values, message: 'Die beiden Passwörter sind nicht gleich.' });

		const [user] = await db
			.insert(users)
			.values({ name, email, passwordHash: await hashPassword(password) })
			.returning({ id: users.id });
		await createSession(cookies, user.id, request.headers.get('user-agent'), url.protocol === 'https:');
		redirect(303, '/einrichten/2fa');
	}
};
