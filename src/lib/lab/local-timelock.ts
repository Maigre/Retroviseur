import type { Roll } from '../roll/types';
import { drawReadyAt } from './develop-time';
import type { Delivery, Lab, LabStatus, LabTicket, SealedFrame } from './types';

/**
 * MVP lab: nothing leaves the phone. The roll stays sealed in local storage
 * until a random 1–3 day deadline passes, then it can be exported as a .zip.
 *
 * Honest limit: the key lives on the device too, so this is a ritual, not
 * security. A server lab removes that limit (docs/ARCHITECTURE.md § Labs).
 */
export class LocalTimelockLab implements Lab {
	readonly kind = 'local-timelock' as const;

	async dropOff(_roll: Roll, _frames: AsyncIterable<SealedFrame>): Promise<LabTicket> {
		const droppedAt = Date.now();
		// Deliberately no `eta`: the user is not told the exact day.
		return { lab: this.kind, droppedAt, data: { readyAt: drawReadyAt(droppedAt) } };
	}

	async status(ticket: LabTicket, now = Date.now()): Promise<LabStatus> {
		return now >= (ticket.data.readyAt as number) ? { state: 'ready' } : { state: 'developing' };
	}

	async collect(_roll: Roll): Promise<Delivery> {
		// TODO(phase 3): unseal frames, zip them (+ contact sheet), return as File.
		throw new Error('LocalTimelockLab.collect not implemented yet');
	}
}
