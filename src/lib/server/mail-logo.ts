import logo from '$lib/assets/mail-logo.png?inline';

/** Logo für den Kopf jeder Mail (eingebettet per Content-ID, siehe $lib/mails) */
export const LOGO_PNG = Buffer.from(logo.slice(logo.indexOf(',') + 1), 'base64');
