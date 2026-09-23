import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		// HTTPS=1 → self-signed cert, so a phone on the LAN gets a secure context (camera).
		...(process.env.HTTPS ? [basicSsl()] : []),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Static SPA build: served as-is by any HTTPS host, and wrapped by Capacitor later.
			adapter: adapter({ fallback: 'index.html' })
		})
	],
	test: { include: ['src/**/*.test.ts'] }
});
