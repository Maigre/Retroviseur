import { expect, it } from 'vitest';
import { Winder } from './winder';

it('locks the shutter until the film is wound', () => {
	const w = new Winder(3);
	expect(w.fire()).toBe(false);
	expect(w.flick()).toBe(false);
	expect(w.flick()).toBe(false);
	expect(w.flick()).toBe(true);
	expect(w.flick()).toBe(false);
	expect(w.fire()).toBe(true);
	expect(w.armed).toBe(false);
});
