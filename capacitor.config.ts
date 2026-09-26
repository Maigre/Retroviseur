import type { CapacitorConfig } from '@capacitor/cli';

// The Android app (docs/ANDROID.md, D57): the same SvelteKit build, bundled.
// Built by `npm run android` (scripts/android.sh), which runs ANDROID=1 vite build first.
const config: CapacitorConfig = {
	appId: 'net.waverz.retroviseur',
	appName: 'Retroviseur',
	webDir: 'build-android',
	// the WebView serves the app at https://localhost — the lab allows that origin (deploy/lab.mjs)
	server: { androidScheme: 'https' },
	android: { backgroundColor: '#0b0d0b' },
	plugins: {
		LocalNotifications: { smallIcon: 'ic_stat_retroviseur', iconColor: '#ffc20e' }
	}
};

export default config;
