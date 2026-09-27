/**
 * The Android app's native camera (v2, D61): a CameraX preview behind the
 * transparent page, placed under the finder, and full-resolution stills with
 * the real flash. Only the app build loads it (see native.ts); the pixels still
 * go through developStill → seal → storage like any other shot.
 */
import { CameraError, type Exposure } from './capture';

interface RetroCameraPlugin {
	start(o: Rect): Promise<{ hasFlash: boolean; zsl?: boolean; width?: number; height?: number }>;
	place(o: Rect): Promise<void>;
	capture(o: { flash: boolean }): Promise<{ path: string }>;
	release(o: { path: string }): Promise<void>;
	stop(): Promise<void>;
}
interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
	radius: number;
}

let plugin: Promise<{ cam: RetroCameraPlugin; fileSrc: (p: string) => string }> | undefined;
const load = () =>
	(plugin ??= __ANDROID_APP__ // compiled out of the web build
		? import('@capacitor/core').then(({ Capacitor, registerPlugin }) => ({
				cam: registerPlugin<RetroCameraPlugin>('RetroCamera'),
				fileSrc: (p: string) => Capacitor.convertFileSrc(p)
			}))
		: Promise.reject(new CameraError('unavailable')));

/** The finder's box on screen, in the WebView's physical pixels. */
export function finderRect(el: HTMLElement): Rect {
	const r = el.getBoundingClientRect();
	const k = devicePixelRatio;
	const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
	return { x: r.left * k, y: r.top * k, width: r.width * k, height: r.height * k, radius: radius * k };
}

export interface NativeOpen {
	hasFlash: boolean;
	report: string;
}

export async function openNative(el: HTMLElement): Promise<NativeOpen> {
	const { cam } = await load();
	try {
		const r = await cam.start(finderRect(el));
		return { hasFlash: r.hasFlash, report: `native CameraX · still ${r.width}×${r.height} · flash ${r.hasFlash} · zsl ${r.zsl}` };
	} catch (e) {
		throw new CameraError(String((e as Error)?.message ?? e).includes('denied') ? 'denied' : 'unavailable', e);
	}
}

export async function placeNative(el: HTMLElement): Promise<void> {
	const { cam } = await load();
	await cam.place(finderRect(el)).catch(() => {});
}

export async function closeNative(): Promise<void> {
	const { cam } = await load();
	await cam.stop().catch(() => {});
}

/** Expose one frame: the native still, decoded — the darkroom comes after (developStill). */
export async function exposeNative(flash: boolean): Promise<Exposure> {
	const { cam, fileSrc } = await load();
	const t0 = performance.now();
	const { path } = await cam.capture({ flash });
	const t1 = performance.now();
	let blob: Blob;
	try {
		blob = await (await fetch(fileSrc(path))).blob();
	} finally {
		void cam.release({ path }); // the unsealed file goes at once
	}
	const bitmap = await createImageBitmap(blob); // EXIF orientation applied: upright for a portrait screen
	return { bitmap, method: flash ? 'native+flash' : 'native', timing: { sensor: Math.round(t1 - t0), read: Math.round(performance.now() - t1) } };
}

/** Where the camera body's plate must stay open: the finder, in the shell's own box. */
export function cutHole(shell: HTMLElement, finder: HTMLElement): void {
	const s = shell.getBoundingClientRect();
	const f = finder.getBoundingClientRect();
	const cs = getComputedStyle(shell);
	const x = f.left - s.left - (parseFloat(cs.borderLeftWidth) || 0);
	const y = f.top - s.top - (parseFloat(cs.borderTopWidth) || 0);
	shell.style.setProperty('--hole-x', `${x}px`);
	shell.style.setProperty('--hole-y', `${y}px`);
	shell.style.setProperty('--hole-w', `${f.width}px`);
	shell.style.setProperty('--hole-h', `${f.height}px`);
}
