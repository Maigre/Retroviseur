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

if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as InstallPromptEvent;
		install.available = true;
	});
	window.addEventListener('appinstalled', () => {
		install.installed = true;
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
