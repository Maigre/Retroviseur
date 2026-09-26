/**
 * Mechanical sounds, synthesized (no audio files): filtered noise bursts.
 * Browsers only allow audio after a user gesture — call unlock() from one.
 */
import { nativeBuzz } from '../native';

export class Sounds {
	#ctx: AudioContext | undefined;
	#noise: AudioBuffer | undefined;

	unlock(): void {
		if (!this.#ctx) {
			const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (!AC) return;
			this.#ctx = new AC();
			const len = Math.floor(this.#ctx.sampleRate * 0.25);
			this.#noise = this.#ctx.createBuffer(1, len, this.#ctx.sampleRate);
			const ch = this.#noise.getChannelData(0);
			for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
		}
		if (this.#ctx.state === 'suspended') void this.#ctx.resume();
	}

	/** One ratchet tooth — fired continuously while the wheel moves. */
	tick(): void {
		this.#burst(0, 0.007, 2600 + Math.random() * 1400, 0.3);
	}

	/** A full flick registered: one advance notch. */
	notch(): void {
		this.#burst(0, 0.014, 1900, 0.6);
	}

	/** The wheel hits its stop: film advanced, shutter armed. */
	lock(): void {
		this.#burst(0, 0.02, 1400, 0.9);
		this.#burst(0.018, 0.03, 700, 0.6);
	}

	/** Shutter clack: blade open, blade close. */
	shutter(): void {
		this.#burst(0, 0.015, 2500, 1);
		this.#burst(0.06, 0.025, 1200, 0.8);
	}

	/** Shutter pressed without winding: a dull, dead click. */
	dry(): void {
		this.#burst(0, 0.02, 400, 0.4);
	}

	#burst(at: number, dur: number, freq: number, gain: number): void {
		const ctx = this.#ctx;
		if (!ctx || !this.#noise) return;
		const t = ctx.currentTime + at;
		const src = ctx.createBufferSource();
		src.buffer = this.#noise;
		const bp = ctx.createBiquadFilter();
		bp.type = 'bandpass';
		bp.frequency.value = freq;
		bp.Q.value = 1.2;
		const g = ctx.createGain();
		g.gain.setValueAtTime(gain, t);
		g.gain.exponentialRampToValueAtTime(0.001, t + dur);
		src.connect(bp).connect(g).connect(ctx.destination);
		src.start(t, Math.random() * 0.2, dur);
	}
}

/**
 * Haptics where the platform has them (Android); nothing on iOS. Pulses are
 * ≥ 20 ms: cheap vibration motors don't spin up for shorter ones.
 * Returns what the browser answered (false = refused or unsupported).
 */
export function buzz(pattern: number | number[]): boolean {
	if (nativeBuzz(pattern)) return true; // the Android app (D57)
	try {
		return navigator.vibrate?.(pattern) ?? false;
	} catch {
		return false;
	}
}

export const HAPTIC = { notch: 25, lock: 60, shutter: 45, dry: 20 } as const;
