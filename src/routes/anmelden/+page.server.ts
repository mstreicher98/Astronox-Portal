import { fail, redirect } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { checkSecondFactor, clearPending, createSession, failedAttempt, getPending, resetAttempts, setPending, tooManyAttempts, verifyPassword } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { safeTarget } from '$lib/server/target';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (locals.user?.totpEnabled) redirect(303, safeTarget(url.searchParams.get('ziel')));
	return { step: getPending(cookies) ? ('code' as const) : ('passwort' as const) };
};

export const actions: Actions = {
	passwort: async ({ request, cookies, url, getClientAddress }) => {
		const ip = getClientAddress();
		if (tooManyAttempts(`ip:${ip}`)) return fail(429, { message: 'Zu viele Versuche. Bitte in 15 Minuten noch einmal.' });
		const fd = await request.formData();
		const email = String(fd.get('email') ?? '').trim().toLowerCase();
		const password = String(fd.get('password') ?? '');
		const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
		// Gleiche Rechenzeit, auch wenn es das Konto nicht gibt
		const ok = await verifyPassword(password, user?.passwordHash ?? 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86));
		if (!user || !ok || tooManyAttempts(`konto:${user.id}`, 12)) {
			failedAttempt(`ip:${ip}`);
			if (user) failedAttempt(`konto:${user.id}`);
			return fail(400, { message: 'E-Mail oder Passwort stimmt nicht.', email });
		}
		const secure = url.protocol === 'https:';
		if (!user.totpEnabled) {
			// Konto ohne zweiten Faktor (nach Zurücksetzen): anmelden und gleich einrichten
			await createSession(cookies, user.id, request.headers.get('user-agent'), secure);
			redirect(303, '/einrichten/2fa');
		}
		setPending(cookies, user.id, secure);
		return { step: 'code' };
	},

	code: async ({ request, cookies, url, getClientAddress }) => {
		const ip = getClientAddress();
		const userId = getPending(cookies);
		if (!userId) return fail(400, { message: 'Die Anmeldung ist abgelaufen. Bitte noch einmal mit Passwort.', restart: true });
		if (tooManyAttempts(`code:${userId}`, 6)) return fail(429, { message: 'Zu viele falsche Codes. Bitte in 15 Minuten noch einmal.' });
		const fd = await request.formData();
		const code = String(fd.get('code') ?? '');
		const [user] = await db.select().from(users).where(eq(users.id, userId));
		const result = user ? await checkSecondFactor(user, code) : null;
		if (!user || !result) {
			failedAttempt(`code:${userId}`);
			failedAttempt(`ip:${ip}`);
			return fail(400, { message: 'Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.' });
		}
		resetAttempts(`code:${userId}`);
		resetAttempts(`ip:${ip}`);
		clearPending(cookies);
		await createSession(cookies, user.id, request.headers.get('user-agent'), url.protocol === 'https:');
		redirect(303, result === 'notfall' ? '/einstellungen/sicherheit?notfall=1' : safeTarget(url.searchParams.get('ziel')));
	},

	zurueck: async ({ cookies }) => {
		clearPending(cookies);
		return { step: 'passwort' };
	}
};
