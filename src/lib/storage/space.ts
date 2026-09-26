/**
 * Storage safety (D51): a roll must fit before it is loaded, and a frame before
 * it is shot — a full phone must never cost a frame silently.
 */
import { EXPOSURES } from '../config';

/** Generous per-frame budget: a developed 3000 px JPEG plus sealing and indexes. */
export const FRAME_BYTES = 6 * 1024 * 1024; // an 11 MP developed frame is ~3–4 MB (D58)
export const ROLL_BYTES = EXPOSURES * FRAME_BYTES;

/** Bytes this site may still store, or null when the browser won't say. */
export async function freeBytes(): Promise<number | null> {
	try {
		const est = await navigator.storage?.estimate?.();
		if (!est?.quota) return null;
		return est.quota - (est.usage ?? 0);
	} catch {
		return null;
	}
}

export function isQuotaError(e: unknown): boolean {
	const name = (e as { name?: string } | null)?.name ?? '';
	return name === 'QuotaExceededError' || /quota/i.test(String((e as Error)?.message ?? ''));
}
