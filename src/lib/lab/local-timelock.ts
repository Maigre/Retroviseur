import { zipSync } from 'fflate';
import type { Roll } from '../roll/types';
import { unseal } from '../roll/seal';
import { drawReadyAt } from './develop-time';
import type { Delivery, Lab, LabStatus, LabTicket, SealedFrame } from './types';

/** Where the local lab reads a roll back from (the RollRepository). */
export interface FrameSource {
	key(rollId: string): Promise<CryptoKey>;
	frames(rollId: string): AsyncIterable<SealedFrame>;
}

/**
 * MVP lab: nothing leaves the phone. The roll stays sealed in local storage
 * until a random 1–3 day deadline passes, then it is handed over as a .zip.
 *
 * Honest limit: the key lives on the device too, so this is a ritual, not
 * security. A server lab removes that limit (docs/ARCHITECTURE.md § Labs).
 */
export class LocalTimelockLab implements Lab {
	readonly kind = 'local-timelock' as const;

	constructor(private source: FrameSource) {}

	async dropOff(_roll: Roll, _frames: AsyncIterable<SealedFrame>, _onProgress?: (done: number, total: number) => void): Promise<LabTicket> {
		const droppedAt = Date.now();
		// Deliberately no `eta`: the user is not told the exact day.
		return { lab: this.kind, droppedAt, data: { readyAt: drawReadyAt(droppedAt) } };
	}

	async status(ticket: LabTicket, now = Date.now()): Promise<LabStatus> {
		return now >= (ticket.data.readyAt as number) ? { state: 'ready' } : { state: 'developing' };
	}

	/** Unseal every frame into a stored (uncompressed) zip — JPEGs don't compress. */
	async collect(roll: Roll): Promise<Delivery> {
		if (roll.state !== 'ready') throw new Error(`a ${roll.state} roll cannot be collected`);
		const key = await this.source.key(roll.id);
		const entries: Record<string, [Uint8Array, { level: 0; mtime: Date }]> = {};
		for await (const f of this.source.frames(roll.id)) {
			const bytes = new Uint8Array(await unseal(key, f.sealed));
			entries[`${archiveName(roll)}/${String(f.meta.index + 1).padStart(2, '0')}.jpg`] = [
				bytes,
				{ level: 0, mtime: new Date(f.meta.takenAt) }
			];
		}
		const zip = zipSync(entries);
		return {
			kind: 'archive',
			file: new File([zip as Uint8Array<ArrayBuffer>], `${archiveName(roll)}.zip`, { type: 'application/zip' })
		};
	}
}

/** retroviseur-2026-09-23 — named after the day the roll was loaded. */
export function archiveName(roll: Roll): string {
	const d = new Date(roll.loadedAt);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `retroviseur-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
