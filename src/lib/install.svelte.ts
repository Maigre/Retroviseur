/**
 * "Add to Home Screen" on Android (D23). Chrome fires `beforeinstallprompt`
 * early — sometimes before any component mounts — so it is captured at module
 * load and kept for the install button.
 */
interface InstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | undefined;
export const install = $state({ available: false, installed: false });

/**
 * Is the app *really* on this device? Chrome's `appinstalled` fires once its
 * servers have built the app, before the Play Store has installed it (it waits in
 * Play's update queue). `getInstalledRelatedApps` (manifest related_applications)
 * answers for real, where supported (Chrome on Android). null = can't tell.
 */
export async function reallyInstalled(): Promise<boolean | null> {
	const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<{ platform: string }[]> };
	if (!nav.getInstalledRelatedApps) return null;
	try {
		return (await nav.getInstalledRelatedApps()).some((a) => a.platform === 'webapp');
	} catch {
		return null;
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as InstallPromptEvent;
		install.available = true;
	});
	// 'appinstalled' only means Chrome handed the app to the Play Store: not installed yet
	window.addEventListener('appinstalled', () => {
		install.available = false;
	});
}

export async function promptInstall(): Promise<boolean> {
	if (!deferred) return false;
	await deferred.prompt();
	const { outcome } = await deferred.userChoice;
	deferred = undefined;
	install.available = false;
	return outcome === 'accepted';
}
