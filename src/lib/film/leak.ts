import { LEAK_HEAD_FRAMES, LEAK_TAIL_FRAMES } from '../config';

/** Deterministic 32-bit hash of a string (FNV-1a) → [0, 1). */
export function hash01(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return (h >>> 0) / 2 ** 32;
}

export interface Leak {
	/** unit vector towards the edge the light bleeds in from (image space, y down) */
	dir: [number, number];
	/** how far into the frame it reaches, 0..1 */
	reach: number;
	strength: number;
}

/**
 * Light leaks fog the first and last frames of a roll, like film exposed while
 * loading and rewinding. Shape and edge are fixed per roll.
 */
export function leakFor(index: number, exposures: number, rollId: string): Leak | null {
	const head = index < LEAK_HEAD_FRAMES;
	const tail = index >= exposures - LEAK_TAIL_FRAMES;
	if (!head && !tail) return null;
	const r = hash01(`${rollId}:${head ? 'head' : 'tail'}`);
	const edges: [number, number][] = [
		[1, 0],
		[-1, 0],
		[0, -1],
		[0, 1]
	];
	return {
		dir: edges[Math.floor(r * 4) % 4],
		reach: 0.25 + ((r * 97) % 1) * 0.35,
		strength: head ? 0.9 : 0.7
	};
}
