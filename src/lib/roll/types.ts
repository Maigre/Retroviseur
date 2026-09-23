import type { FilmStockId } from '../film/stocks';
import type { LabTicket } from '../lab/types';

/**
 * Lifecycle of a roll. It only ever moves forward:
 *
 *   loaded → full → developing → ready → collected
 *
 * - loaded:     in the camera, frames are being exposed
 * - full:       all exposures taken, waiting to be dropped at the lab
 * - developing: handed to a Lab; frames are sealed, nothing is viewable
 * - ready:      the Lab says the prints are back
 * - collected:  exported off the device; local frames are wiped
 */
export type RollState = 'loaded' | 'full' | 'developing' | 'ready' | 'collected';

export interface Roll {
	id: string;
	state: RollState;
	/** Stock baked into the frames at capture time (fixed per build). */
	stock: FilmStockId;
	exposures: number;
	/** Frames exposed so far. Frames themselves live in storage, never in UI state. */
	shot: number;
	/** Film advanced and shutter armed — survives reloads, like a real wound camera. */
	wound?: boolean;
	loadedAt: number;
	fullAt?: number;
	/** Set once the roll is dropped off; opaque to everything but its Lab. */
	ticket?: LabTicket;
	collectedAt?: number;
}

/** Metadata recorded per frame at capture; the pixels are stored sealed. */
export interface FrameMeta {
	index: number;
	takenAt: number;
	flash: boolean;
}
