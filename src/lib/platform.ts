/** iPhone/iPad in a browser (iPadOS reports itself as a Mac with touch). */
export function isIOS(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = globalThis.navigator): boolean {
	if (!nav) return false;
	return /iPhone|iPad|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
}

/**
 * Flash switch availability (D14). The browser can't reliably drive the
 * torch on iOS, so the switch is hidden there until the native (Capacitor)
 * app can use the real flash.
 */
export function hasFlash(): boolean {
	return !isIOS();
}
