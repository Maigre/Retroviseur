import { EXPOSURES } from '../config';
import type { FilmStockId } from '../film/stocks';
import type { LabTicket } from '../lab/types';
import type { Roll } from './types';

export class RollError extends Error {}

export function loadRoll(stock: FilmStockId, now = Date.now(), id: string = crypto.randomUUID()): Roll {
	return { id, state: 'loaded', stock, exposures: EXPOSURES, shot: 0, loadedAt: now };
}

export function framesLeft(roll: Roll): number {
	return roll.exposures - roll.shot;
}

/** Record one exposure. The roll becomes `full` on the last frame. */
export function expose(roll: Roll, now = Date.now()): Roll {
	if (roll.state !== 'loaded') throw new RollError(`cannot expose a ${roll.state} roll`);
	const shot = roll.shot + 1;
	return shot >= roll.exposures
		? { ...roll, shot, wound: false, state: 'full', fullAt: now }
		: { ...roll, shot, wound: false };
}

export function dropOff(roll: Roll, ticket: LabTicket): Roll {
	if (roll.state !== 'full') throw new RollError(`cannot develop a ${roll.state} roll`);
	return { ...roll, state: 'developing', ticket };
}

export function markReady(roll: Roll): Roll {
	if (roll.state !== 'developing') throw new RollError(`a ${roll.state} roll is not developing`);
	return { ...roll, state: 'ready' };
}

export function markCollected(roll: Roll, now = Date.now()): Roll {
	if (roll.state !== 'ready') throw new RollError(`a ${roll.state} roll is not ready`);
	return { ...roll, state: 'collected', collectedAt: now };
}
