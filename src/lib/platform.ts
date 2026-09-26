/** iPhone/iPad in a browser (iPadOS reports itself as a Mac with touch). */
export function isIOS(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = globalThis.navigator): boolean {
	if (!nav) return false;
	return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

export function isAndroid(nav: Pick<Navigator, 'userAgent'> | undefined = globalThis.navigator): boolean {
	return !!nav && /Android/.test(nav.userAgent);
}

/**
 * Launched from the home screen (installed PWA) rather than a browser tab —
 * in fullscreen (D47, hides Android's bars) or standalone (the fallback).
 */
export function isStandalone(): boolean {
	return (
		__ANDROID_APP__ || // the Android app is installed by definition
		globalThis.matchMedia?.('(display-mode: fullscreen)').matches === true ||
		globalThis.matchMedia?.('(display-mode: standalone)').matches === true ||
		(globalThis.navigator as { standalone?: boolean } | undefined)?.standalone === true
	);
}

/**
 * Ask the browser not to evict our storage. Losing a roll is the worst bug.
 * Returns whether storage is (now) persistent.
 */
export async function persistStorage(): Promise<boolean> {
	try {
		if (await navigator.storage?.persisted?.()) return true;
		return (await navigator.storage?.persist?.()) ?? false;
	} catch {
		return false;
	}
}

const BROWSER_KEY = 'retroviseur-browser';

/**
 * The user chose to use Retroviseur in the browser instead of installing it (D48).
 * An explicit, remembered choice — never implied by starting an install.
 */
export function browserMode(): boolean {
	try {
		return localStorage.getItem(BROWSER_KEY) === '1';
	} catch {
		return false;
	}
}

export function setBrowserMode(on: boolean): void {
	try {
		if (on) localStorage.setItem(BROWSER_KEY, '1');
		else localStorage.removeItem(BROWSER_KEY);
	} catch {
		// private mode: the choice lasts for this page only
	}
}
