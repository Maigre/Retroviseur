/**
 * The lab's archive container: `RTVL1`, then the sealed manifest and each sealed
 * frame, each as u32 big-endian length ‖ bytes (docs/LAB.md). A sealed part is
 * iv (12 bytes) ‖ AES-GCM ciphertext.
 */
import type { Sealed } from '../roll/seal';

const MAGIC = [0x52, 0x54, 0x56, 0x4c, 0x31]; // RTVL1

export function packSealed(s: Sealed): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(s.iv.length + s.data.byteLength);
	out.set(s.iv, 0);
	out.set(new Uint8Array(s.data), s.iv.length);
	return out;
}

export function unpackSealed(bytes: Uint8Array): Sealed {
	return { iv: bytes.slice(0, 12), data: bytes.slice(12).buffer };
}

export function parseArchive(buf: ArrayBuffer): { manifest: Uint8Array; frames: Uint8Array[] } {
	const u8 = new Uint8Array(buf);
	if (MAGIC.some((b, i) => u8[i] !== b)) throw new Error('not a Retroviseur roll');
	const view = new DataView(buf);
	const parts: Uint8Array[] = [];
	let o = MAGIC.length;
	while (o < u8.length) {
		const n = view.getUint32(o);
		o += 4;
		if (o + n > u8.length) throw new Error('truncated roll');
		parts.push(u8.subarray(o, o + n));
		o += n;
	}
	const [manifest, ...frames] = parts;
	if (!manifest) throw new Error('empty roll');
	return { manifest, frames };
}

/** Test helper: the inverse of parseArchive. */
export function buildArchive(parts: Uint8Array[]): ArrayBuffer {
	const size = MAGIC.length + parts.reduce((a, p) => a + 4 + p.length, 0);
	const out = new Uint8Array(size);
	out.set(MAGIC, 0);
	const view = new DataView(out.buffer);
	let o = MAGIC.length;
	for (const p of parts) {
		view.setUint32(o, p.length);
		out.set(p, o + 4);
		o += 4 + p.length;
	}
	return out.buffer;
}

/** What the sealed manifest holds. */
export interface Manifest {
	v: 1;
	stock: string;
	loadedAt: number;
	exposures: number;
	frames: { index: number; takenAt: number; flash: boolean }[];
}
