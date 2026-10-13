import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: 'build', precompress: true }),
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// Svelte setzt für Übergänge und Animationen Inline-Styles
				'style-src': ['self', 'unsafe-inline'],
				// blob: für die Vorschau beim Hochladen. Bilder aus Mails werden nicht nachgeladen.
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'worker-src': ['self'],
				'manifest-src': ['self'],
				// frame-src (Vorschau der Webseite) ergänzt hooks.server.ts mit WEBSITE_URL
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
