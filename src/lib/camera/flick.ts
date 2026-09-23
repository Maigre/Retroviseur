import { FLICK_MAX_MS, FLICK_MIN_PX } from '../config';

/**
 * Turns a pointer stroke on the thumbwheel into at most ONE ratchet click:
 * the finger must travel `minPx` upward within `maxMs` of touching down.
 * Several flicks are needed to wind the film (Winder counts them).
 */
export class FlickDetector {
	#startY = 0;
	#startT = 0;
	#active = false;
	#clicked = false;

	constructor(
		readonly minPx = FLICK_MIN_PX,
		readonly maxMs = FLICK_MAX_MS
	) {}

	start(y: number, t: number): void {
		this.#startY = y;
		this.#startT = t;
		this.#active = true;
		this.#clicked = false;
	}

	/** Upward travel of the current stroke in px (≥ 0), for the wheel animation. */
	travel(y: number): number {
		return this.#active ? Math.max(0, this.#startY - y) : 0;
	}

	/** Returns true exactly once per stroke, when it qualifies as a flick. */
	move(y: number, t: number): boolean {
		if (!this.#active || this.#clicked) return false;
		if (t - this.#startT > this.maxMs) return false;
		if (this.#startY - y >= this.minPx) {
			this.#clicked = true;
			return true;
		}
		return false;
	}

	end(): void {
		this.#active = false;
	}
}
