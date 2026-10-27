import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Digital Asset Links: bestätigt Android, dass die App „dev.astronox.portal“ zum Portal gehört.
 * Erst dann öffnet sie das Portal im Vollbild statt mit Adressleiste. Der Fingerabdruck des
 * Signaturschlüssels ist öffentlich. Lädt man die App später in Google Play hoch, signiert Google
 * neu – dessen Fingerabdruck dann über ANDROID_CERT_SHA256 ergänzen (mehrere mit Komma).
 */
const PACKAGE = 'dev.astronox.portal';
const FINGERPRINTS = ['BC:F1:31:ED:1E:D0:DE:DF:E0:CE:B0:2D:A1:7E:43:80:E7:F5:6A:C0:0F:67:99:DD:87:87:19:2F:B3:16:7B:34'];

export const GET: RequestHandler = () => {
	const extra = (env.ANDROID_CERT_SHA256 ?? '')
		.split(',')
		.map((s) => s.trim().toUpperCase())
		.filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
	return json(
		[
			{
				relation: ['delegate_permission/common.handle_all_urls'],
				target: { namespace: 'android_app', package_name: PACKAGE, sha256_cert_fingerprints: [...new Set([...FINGERPRINTS, ...extra])] }
			}
		],
		{ headers: { 'cache-control': 'public, max-age=3600' } }
	);
};
