import { CAPTURE_MAX_LONG_SIDE, JPEG_QUALITY } from '../config';
import { crop3x2 } from './crop';

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
 * Returns a 3:2 JPEG. The film look will be applied here in phase 2.
 */
export interface Still {
	jpeg: Blob;
	/** how the pixels were obtained, for the dev panel */
	method: 'takePhoto' | 'takePhoto+flash' | 'video' | 'video+torch';
	sourceWidth: number;
	sourceHeight: number;
}

export async function captureStill(
	stream: MediaStream,
	video: HTMLVideoElement,
	rotate: 0 | -90 = 0,
	flash: FlashSupport | null = null
): Promise<Still> {
	const { bitmap, method } = await withFlash(stream, flash, () => grab(stream, video, !!flash?.fill));
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
		const jpeg = await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', JPEG_QUALITY)
		);
		return { jpeg, method, sourceWidth: bitmap.width, sourceHeight: bitmap.height };
	} finally {
		bitmap.close();
	}
}

/**
 * Real flash where takePhoto supports it; otherwise, where the torch exists,
 * light it just for the capture (a moment for exposure to settle), then off.
 */
async function withFlash<T extends { method: Still['method'] }>(
	stream: MediaStream,
	flash: FlashSupport | null,
	capture: () => Promise<T>
): Promise<T> {
	if (!flash || flash.fill || !flash.torch) return capture();
	const track = stream.getVideoTracks()[0];
	const torch = (on: boolean) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
	try {
		await torch(true);
		await new Promise((r) => setTimeout(r, 350));
		const out = await capture();
		return { ...out, method: out.method === 'video' ? 'video+torch' : out.method };
	} finally {
		await torch(false).catch(() => {});
	}
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
