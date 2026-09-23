import type { Sealed } from '../roll/seal';
import type { FrameMeta, Roll } from '../roll/types';

/**
 * A Lab is wherever a full roll goes to be "developed". The camera never
 * knows which one it talks to — that is what lets the MVP time-lock evolve
 * into an email lab, then a real photo lab, without touching the capture UI.
 */
export type LabKind = 'local-timelock' | 'email' | 'photolab';

/** Proof of drop-off, persisted on the Roll. `data` is private to the Lab. */
export interface LabTicket {
	lab: LabKind;
	droppedAt: number;
	/** Best known ETA; a Lab may keep the real date secret. */
	eta?: number;
	data: Record<string, unknown>;
}

export interface SealedFrame {
	meta: FrameMeta;
	/** Encrypted JPEG bytes (see docs/ARCHITECTURE.md § Sealing). */
	sealed: Sealed;
}

export type LabStatus = { state: 'developing' } | { state: 'ready' };

/** How the prints come back to the user. */
export type Delivery =
	/** The archive is handed to the device (share sheet / download). */
	| { kind: 'archive'; file: File }
	/** The prints went somewhere else (email, postal pack…); nothing lands on the phone. */
	| { kind: 'elsewhere'; message: string };

export interface Lab {
	readonly kind: LabKind;
	dropOff(roll: Roll, frames: AsyncIterable<SealedFrame>): Promise<LabTicket>;
	status(ticket: LabTicket, now?: number): Promise<LabStatus>;
	collect(roll: Roll): Promise<Delivery>;
}
