import { expect, it } from 'vitest';
import { buildLut, monotoneCubic } from './curve';
import { hash01, leakFor } from './leak';
import { formatStamp, SEGMENTS } from './stamp';
import { STOCKS } from './stocks';

it('curves pass through their points and never go backwards', () => {
	const pts: [number, number][] = [[0, 0.02], [0.25, 0.23], [0.75, 0.8], [1, 0.98]];
	const f = monotoneCubic(pts);
	for (const [x, y] of pts) expect(f(x)).toBeCloseTo(y, 6);
	let prev = -1;
	for (let i = 0; i <= 100; i++) {
		const y = f(i / 100);
		expect(y).toBeGreaterThanOrEqual(prev);
		prev = y;
	}
});

it('bakes each stock into a 256-entry RGBA table', () => {
	for (const s of Object.values(STOCKS)) {
		const lut = buildLut(s.curves);
		expect(lut.length).toBe(1024);
		expect(lut[3]).toBe(255);
		expect(lut[255 * 4]).toBeGreaterThan(lut[0]); // red rises
	}
});

it('stamps the date the 90s way', () => {
	expect(formatStamp(new Date(2026, 8, 23))).toBe("'26 9 23");
	expect(formatStamp(new Date(2030, 11, 1))).toBe("'30 12 1");
	expect(SEGMENTS['8']).toBe('abcdefg');
});

it('leaks light only into the first and last frames, the same way per roll', () => {
	expect(leakFor(5, 27, 'roll-a')).toBeNull();
	const head = leakFor(0, 27, 'roll-a');
	const tail = leakFor(26, 27, 'roll-a');
	expect(head).not.toBeNull();
	expect(tail).not.toBeNull();
	expect(leakFor(0, 27, 'roll-a')).toEqual(head);
	expect(hash01('x')).toBeGreaterThanOrEqual(0);
	expect(hash01('x')).toBeLessThan(1);
});
