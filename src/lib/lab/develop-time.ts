import { DEVELOP_MAX_HOURS, DEVELOP_MIN_HOURS } from '../config';

const HOUR = 3_600_000;

/** Pick when a roll dropped off at `now` comes back. Uniform in [min, max] hours. */
export function drawReadyAt(now: number, rand: () => number = Math.random): number {
	const hours = DEVELOP_MIN_HOURS + rand() * (DEVELOP_MAX_HOURS - DEVELOP_MIN_HOURS);
	return now + Math.round(hours * HOUR);
}
