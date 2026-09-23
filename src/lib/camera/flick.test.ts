import { expect, it } from 'vitest';
import { FlickDetector } from './flick';

it('counts one click per quick upward stroke', () => {
	const f = new FlickDetector(20, 400);
	f.start(100, 0);
	expect(f.move(90, 50)).toBe(false);
	expect(f.move(79, 80)).toBe(true);
	expect(f.move(40, 120)).toBe(false); // same stroke, no second click
	f.end();
	f.start(100, 1000);
	expect(f.move(130, 1050)).toBe(false); // downward
	expect(f.move(75, 1500)).toBe(false); // too slow
});
