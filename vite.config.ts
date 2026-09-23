import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Short commit shown in the About sheet (gaff builds from its git checkout).
const version = (() => {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'dev';
	}
})();

export default defineConfig({
	define: { __APP_VERSION__: JSON.stringify(version) },
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
