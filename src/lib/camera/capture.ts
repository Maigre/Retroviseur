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

export function closeCamera(stream: MediaStream | undefined): void {
	stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Grab one full-resolution still. Chrome/Android: ImageCapture.takePhoto()
 * (real sensor still). Elsewhere (iOS Safari): the current video frame.
 * Returns a 3:2 JPEG. The film look will be applied here in phase 2.
 */
export async function captureStill(stream: MediaStream, video: HTMLVideoElement): Promise<Blob> {
	const bitmap = await grab(stream, video);
	try {
		const c = crop3x2(bitmap.width, bitmap.height, CAPTURE_MAX_LONG_SIDE);
		const canvas = document.createElement('canvas');
		canvas.width = c.dw;
		canvas.height = c.dh;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('2d canvas unavailable');
		ctx.drawImage(bitmap, c.sx, c.sy, c.sw, c.sh, 0, 0, c.dw, c.dh);
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', JPEG_QUALITY)
		);
	} finally {
		bitmap.close();
	}
}

async function grab(stream: MediaStream, video: HTMLVideoElement): Promise<ImageBitmap> {
	const track = stream.getVideoTracks()[0];
	const IC = (globalThis as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
	if (IC && track) {
		try {
			return await createImageBitmap(await new IC(track).takePhoto());
		} catch {
			// some devices reject takePhoto on certain streams — fall back to the video frame
		}
	}
	return createImageBitmap(video);
}
