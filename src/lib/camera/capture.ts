import { CAPTURE_MAX_LONG_SIDE, JPEG_QUALITY, TORCH_SETTLE_MS } from '../config';
import { crop3x2 } from './crop';
import { develop, type DevelopOptions } from '../film/develop';

export type CameraErrorKind = 'denied' | 'unavailable' | 'insecure';

export class CameraError extends Error {
	constructor(readonly kind: CameraErrorKind, cause?: unknown) {
		super(kind, { cause });
	}
}

/** Rear camera, as large as the device will give us. No audio. */
export async function openCamera(): Promise<MediaStream> {
	if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new CameraError('insecure');
	try {
		return await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				facingMode: { ideal: 'environment' },
				width: { ideal: 4096 },
				height: { ideal: 4096 }
			}
		});
	} catch (e) {
		const name = (e as DOMException)?.name;
		throw new CameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable', e);
	}
}

type PhotoCaps = { fillLightMode?: string[] };
type ImageCaptureLike = {
	takePhoto(settings?: { fillLightMode?: string }): Promise<Blob>;
	getPhotoCapabilities?(): Promise<PhotoCaps>;
};
const ImageCaptureCtor = () =>
	(globalThis as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture;

export interface FlashSupport {
	/** takePhoto can fire the real flash (fillLightMode 'flash') */
	fill: boolean;
	/** the torch can be switched on around the capture */
	torch: boolean;
	/** raw report, for the dev panel */
	report: string;
}

/** What this camera + browser can do for the flash switch (D35). */
export async function flashSupport(stream: MediaStream): Promise<FlashSupport> {
	const track = stream.getVideoTracks()[0];
	const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
	let modes: string[] = [];
	const IC = ImageCaptureCtor();
	if (IC && track) {
		try {
			modes = (await new IC(track).getPhotoCapabilities?.())?.fillLightMode ?? [];
		} catch {
			// no photo capabilities on this device
		}
	}
	const fill = modes.includes('flash');
	const torch = caps.torch === true;
	return {
		fill,
		torch,
		report: `ImageCapture ${IC ? 'yes' : 'no'} · fillLightMode [${modes.join(', ')}] · torch ${torch}`
	};
}

export function closeCamera(stream: MediaStream | undefined): void {
	stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Grab one full-resolution still. Chrome/Android: ImageCapture.takePhoto()
 * (real sensor still). Elsewhere (iOS Safari): the current video frame.
 * Returns a 3:2 JPEG with the film look applied when `film` is given.
 */
export interface Still {
	jpeg: Blob;
	/** how the pixels were obtained, for the dev panel */
	method: 'takePhoto' | 'takePhoto+flash' | 'video' | 'video+torch' | 'native' | 'native+flash';
	sourceWidth: number;
	sourceHeight: number;
	/** the film look was applied (false: no WebGL2, or no film options) */
	developed: boolean;
}

export async function captureStill(
	stream: MediaStream,
	video: HTMLVideoElement,
	rotate: 0 | -90 = 0,
	flash: FlashSupport | null = null,
	film: DevelopOptions | null = null
): Promise<Still> {
	const { bitmap, method } = await withFlash(stream, video, flash);
	return developStill(bitmap, method, rotate, film);
}

/**
 * The darkroom half of a shot, whatever took it (web camera or the app's native
 * one): crop to 3:2 at most CAPTURE_MAX_LONG_SIDE, turn upright, bake the film
 * look in, encode. Closes the bitmap.
 */
export async function developStill(
	bitmap: ImageBitmap,
	method: Still['method'],
	rotate: 0 | -90,
	film: DevelopOptions | null
): Promise<Still> {
	try {
		const c = crop3x2(bitmap.width, bitmap.height, CAPTURE_MAX_LONG_SIDE);
		const canvas = document.createElement('canvas');
		// -90: the phone is held sideways on a portrait-locked screen, so world-up is
		// the frame's right edge — turn it a quarter-turn anticlockwise.
		canvas.width = rotate ? c.dh : c.dw;
		canvas.height = rotate ? c.dw : c.dh;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2d canvas unavailable');
		if (rotate) {
			ctx.translate(0, canvas.height);
			ctx.rotate(-Math.PI / 2);
		}
		ctx.drawImage(bitmap, c.sx, c.sy, c.sw, c.sh, 0, 0, c.dw, c.dh);
		// the film look, baked in before the frame is sealed (D40)
		const out = film ? develop(canvas, film) : canvas;
		const jpeg = await new Promise<Blob>((resolve, reject) =>
			out.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', JPEG_QUALITY)
		);
		return { jpeg, method, sourceWidth: bitmap.width, sourceHeight: bitmap.height, developed: !!film && out !== canvas };
	} finally {
		bitmap.close();
	}
}

/**
 * Flash (D36). With a torch: light it, let exposure settle, take the *video*
 * frame while it is lit, then switch it off — the light is on at the exact
 * moment of the shot (takePhoto reconfigures the camera and its flash timing
 * belongs to the phone's camera software, which fired late). Without a torch
 * but with a fill-light mode: takePhoto with the flash. No flash: plain capture.
 */
async function withFlash(
	stream: MediaStream,
	video: HTMLVideoElement,
	flash: FlashSupport | null
): Promise<{ bitmap: ImageBitmap; method: Still['method'] }> {
	if (!flash) return grab(stream, video);
	if (!flash.torch) return grab(stream, video, flash.fill);
	const track = stream.getVideoTracks()[0];
	const torch = (on: boolean) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
	try {
		await torch(true);
		await new Promise((r) => setTimeout(r, TORCH_SETTLE_MS));
		await nextFrame(video); // a frame rendered with the light on
		return { bitmap: await createImageBitmap(video), method: 'video+torch' };
	} finally {
		await torch(false).catch(() => {});
	}
}

function nextFrame(video: HTMLVideoElement): Promise<void> {
	const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
	return new Promise((resolve) => (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(() => resolve()) : requestAnimationFrame(() => resolve())));
}

async function grab(
	stream: MediaStream,
	video: HTMLVideoElement,
	fireFlash = false
): Promise<{ bitmap: ImageBitmap; method: Still['method'] }> {
	const track = stream.getVideoTracks()[0];
	const IC = ImageCaptureCtor();
	if (IC && track) {
		try {
			const blob = await new IC(track).takePhoto(fireFlash ? { fillLightMode: 'flash' } : undefined);
			return { bitmap: await createImageBitmap(blob), method: fireFlash ? 'takePhoto+flash' : 'takePhoto' };
		} catch {
			// some devices reject takePhoto on certain streams — fall back to the video frame
		}
	}
	return { bitmap: await createImageBitmap(video), method: 'video' };
}
