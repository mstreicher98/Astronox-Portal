import { error, redirect, type Handle, type HandleServerError, type ServerInit } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { hasUser, readSession, setupCode } from '$lib/server/auth';
import { ensureDatabase } from '$lib/server/db';
import { startJobs } from '$lib/server/jobs';
import { seedPortal } from '$lib/server/seed';

const websiteOrigin = () => {
	try {
		return new URL(env.WEBSITE_URL || 'https://astronox.dev').origin;
	} catch {
		return 'https://astronox.dev';
	}
};

let userExists = false;

export const init: ServerInit = async () => {
	await ensureDatabase();
	await seedPortal();
	userExists = await hasUser();
	if (!userExists) {
		console.info(`\n[portal] Noch kein Konto angelegt. Einrichtungscode: ${setupCode}\n[portal] Öffne ${env.PORTAL_URL || env.ORIGIN || 'https://portal.astronox.dev'}/einrichten\n`);
	}
	startJobs();
};

/** Ohne Anmeldung erreichbar */
const PUBLIC = /^\/(anmelden|einrichten|healthz|manifest\.webmanifest|service-worker\.js|favicon|icon-|apple-touch-icon|_app\/)/;

export const handle: Handle = async ({ event, resolve }) => {
	await ensureDatabase();
	const { url, cookies } = event;
	const path = url.pathname;
	const secure = url.protocol === 'https:';

	event.locals.user = null;
	event.locals.sessionId = null;
	const session = await readSession(cookies, secure);
	if (session) {
		event.locals.user = session.user;
		event.locals.sessionId = session.sessionId;
	}

	if (!userExists) userExists = await hasUser();
	if (!userExists && !path.startsWith('/einrichten') && path !== '/healthz' && !path.startsWith('/_app/')) redirect(303, '/einrichten');

	if (!PUBLIC.test(path)) {
		const user = event.locals.user;
		if (!user) {
			if (event.request.method === 'GET' && !path.startsWith('/api/')) {
				redirect(303, `/anmelden${path !== '/' ? `?ziel=${encodeURIComponent(path + url.search)}` : ''}`);
			}
			error(401, 'Bitte anmelden.');
		}
		// Zwei-Faktor ist Pflicht: ohne eingerichtete App geht es nur zur Einrichtung
		if (!user.totpEnabled && !path.startsWith('/einrichten/2fa')) redirect(303, '/einrichten/2fa');
	}

	const response = await resolve(event, {
		preload: ({ type, path }) => type === 'js' || type === 'css' || (type === 'font' && /-latin-w(dth|ght)-normal/.test(path))
	});

	const csp = response.headers.get('content-security-policy');
	// Rahmen: eigene PDFs (Belegvorschau) und die Vorschau der Webseite
	if (csp) response.headers.set('content-security-policy', `${csp}; frame-src 'self' ${websiteOrigin()}`);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()');
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	if (secure) response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	if (!response.headers.has('Cache-Control') && !path.startsWith('/_app/immutable/')) response.headers.set('Cache-Control', 'private, no-store');
	return response;
};

export const handleError: HandleServerError = ({ error, status }) => {
	if (status !== 404 && status !== 401) console.error(error);
	return { message: status === 404 ? 'Diese Seite gibt es nicht.' : status === 401 ? 'Bitte anmelden.' : 'Unerwarteter Fehler – Details stehen im Protokoll des Containers.' };
};
