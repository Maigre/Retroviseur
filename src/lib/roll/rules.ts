import type { Roll } from './types';

/**
 * How many rolls may exist at once (D13): one in the camera (loaded or full)
 * and one at the lab (developing or ready). A second full roll waits in the
 * camera until the one at the lab has been collected.
 */
const inCamera = (r: Roll) => r.state === 'loaded' || r.state === 'full';
const atLab = (r: Roll) => r.state === 'developing' || r.state === 'ready';

export function canLoad(rolls: readonly Roll[]): boolean {
	return !rolls.some(inCamera);
}

export function canDropOff(roll: Roll, rolls: readonly Roll[]): boolean {
	return roll.state === 'full' && !rolls.some(atLab);
}
