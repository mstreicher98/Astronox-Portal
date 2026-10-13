import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5210,
		strictPort: true,
		// Auf Laufwerk M: kommen nicht alle Dateiänderungen als Ereignis an
		watch: { usePolling: true, interval: 300 }
	},
	test: {
		include: ['src/**/*.test.ts']
	}
});
