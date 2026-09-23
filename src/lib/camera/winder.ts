import { WIND_CLICKS } from '../config';

/**
 * Film-advance thumbwheel. The shutter is locked until the wheel has been
 * flicked `clicks` times; firing re-locks it. Pure logic — the gesture
 * recogniser, haptics and sound live in the UI component.
 */
export class Winder {
	#clicks = 0;
	constructor(readonly clicksNeeded = WIND_CLICKS) {}

	get progress(): number {
		return this.#clicks / this.clicksNeeded;
	}

	get armed(): boolean {
		return this.#clicks >= this.clicksNeeded;
	}

	/** One ratchet click. Returns true on the click that arms the shutter. */
	flick(): boolean {
		if (this.armed) return false;
		this.#clicks++;
		return this.armed;
	}

	/** Consume the advanced frame. Returns false (dry fire) if not armed. */
	fire(): boolean {
		if (!this.armed) return false;
		this.#clicks = 0;
		return true;
	}
}
