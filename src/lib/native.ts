/**
 * The Android app's native side (docs/ANDROID.md, D57). Everything here is a
 * no-op in the web build: `__ANDROID_APP__` is false there and the Capacitor
 * plugins are only imported inside the guarded branches, so they never reach the
 * PWA's bundle.
 */
import { HOME } from './move';

export const NATIVE: boolean = __ANDROID_APP__;

/** Where the lab lives: same origin on the web, the public address from the app. */
export const LAB_API = `${NATIVE ? HOME : ''}/api/lab`;

/** Vibration through Android itself (the WebView has no `navigator.vibrate`). */
export function nativeBuzz(pattern: number | number[]): boolean {
	if (!NATIVE) return false;
	const steps = typeof pattern === 'number' ? [pattern] : pattern;
	void import('@capacitor/haptics').then(({ Haptics }) => {
		let at = 0;
		steps.forEach((ms, i) => {
			if (i % 2 === 0) setTimeout(() => void Haptics.vibrate({ duration: ms }).catch(() => {}), at);
			at += ms;
		});
	});
	return true;
}

/** Really leave the app (D55's close button). False on the web. */
export async function exitApp(): Promise<boolean> {
	if (!NATIVE) return false;
	const { App } = await import('@capacitor/app');
	await App.exitApp();
	return true;
}

/**
 * A notification the phone shows by itself at `at` — no server push, so the lab
 * still learns nothing about who is waiting. Asks permission the first time.
 */
export async function notifyAt(id: number, at: number, title: string, body: string): Promise<void> {
	if (!NATIVE) return;
	const { LocalNotifications } = await import('@capacitor/local-notifications');
	try {
		let p = await LocalNotifications.checkPermissions();
		if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions();
		if (p.display !== 'granted') return;
		await LocalNotifications.cancel({ notifications: [{ id }] });
		await LocalNotifications.schedule({ notifications: [{ id, title, body, schedule: { at: new Date(at), allowWhileIdle: true } }] });
	} catch {
		// no notification: the app still says it on open (D16)
	}
}

export async function cancelNotify(id: number): Promise<void> {
	if (!NATIVE) return;
	const { LocalNotifications } = await import('@capacitor/local-notifications');
	await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
}

/** A notification id per roll, stable across launches. */
export function notifyId(rollId: string, kind: 'ready' | 'call'): number {
	let h = kind === 'ready' ? 7 : 13;
	for (const c of rollId) h = (h * 31 + c.charCodeAt(0)) | 0;
	return Math.abs(h) % 2_000_000_000;
}

/**
 * A ticket link opened on this phone (Android App Links, D57): hand back the
 * in-app path, `/lab/<id>#<key>`. Only our own address is taken.
 */
const LAUNCH_KEY = 'retroviseur-launch-url';

export function onTicketLink(go: (path: string) => void): void {
	if (!NATIVE) return;
	void import('@capacitor/app').then(({ App }) => {
		const take = (url: string | undefined) => {
			const path = ticketPath(url);
			if (path) go(path);
		};
		void App.addListener('appUrlOpen', (e) => take(e.url));
		// the launch URL is reported again after every reload: take it once per launch
		void App.getLaunchUrl().then((l) => {
			try {
				if (!l?.url || sessionStorage.getItem(LAUNCH_KEY) === l.url) return;
				sessionStorage.setItem(LAUNCH_KEY, l.url);
			} catch {
				// no session storage: better a lost link than a reload loop
				return;
			}
			take(l.url);
		});
	});
}

export function ticketPath(url: string | undefined): string | null {
	if (!url) return null;
	try {
		const u = new URL(url);
		if (u.origin !== HOME || !/^\/lab\/[\w-]+$/.test(u.pathname)) return null;
		return u.pathname + u.hash;
	} catch {
		return null;
	}
}

/**
 * The Android share sheet (the WebView has no Web Share API). True once shared;
 * throws an AbortError-named error when the user backs out, like the web API.
 */
export async function nativeShare(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
	if (!NATIVE) return false;
	const { Share } = await import('@capacitor/share');
	try {
		await Share.share(data);
		return true;
	} catch (e) {
		const err = new Error(String(e));
		err.name = 'AbortError'; // cancelled (the plugin rejects on dismiss)
		throw err;
	}
}

/** Where the app is downloaded from and checks for a newer build (scripts/android-publish.sh). */
export const APK_URL = `${HOME}/android/retroviseur.apk`;

/** True when a newer APK than this one is published. Never throws. */
export async function appUpdateAvailable(): Promise<boolean> {
	if (!NATIVE) return false;
	try {
		const { App } = await import('@capacitor/app');
		const [info, r] = await Promise.all([App.getInfo(), fetch(`${HOME}/android/version.json`, { cache: 'no-store' })]);
		if (!r.ok) return false;
		const { versionCode } = await r.json();
		return Number(versionCode) > Number(info.build);
	} catch {
		return false;
	}
}
