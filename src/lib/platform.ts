/** iPhone/iPad in a browser (iPadOS reports itself as a Mac with touch). */
export function isIOS(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = globalThis.navigator): boolean {
	if (!nav) return false;
	return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

export function isAndroid(nav: Pick<Navigator, 'userAgent'> | undefined = globalThis.navigator): boolean {
	return !!nav && /Android/.test(nav.userAgent);
}

/** Launched from the home screen (installed PWA) rather than a browser tab. */
export function isStandalone(): boolean {
	return (
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
